from __future__ import annotations

import base64
import csv
import io
import json
import math
import statistics
import sys
from pathlib import Path
from typing import Any


TIME_CANDIDATES = ["time", "Time", "timestamp", "Timestamp", "t"]
COP_X_CANDIDATES = ["cop_x", "COPx", "COP_X", "x", "X", "xp"]
COP_Y_CANDIDATES = ["cop_y", "COPy", "COP_Y", "y", "Y", "yp"]


def decode_csv_bytes(file_bytes: bytes) -> str:
    last_error: Exception | None = None
    for encoding in ("cp932", "shift_jis", "utf-8-sig", "utf-8"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError as exc:
            last_error = exc
    if last_error is not None:
        raise last_error
    return file_bytes.decode("utf-8")


def parse_csv_text(text: str) -> list[list[str]]:
    reader = csv.reader(io.StringIO(text.replace("\r\n", "\n").replace("\r", "\n")))
    return [list(row) for row in reader]


def normalize_cell(value: Any) -> str:
    return str(value if value is not None else "").strip()


def coerce_cell(value: Any) -> Any:
    text = normalize_cell(value)
    if text == "":
        return math.nan
    try:
        return float(text)
    except ValueError:
        return text


def auto_detect_column(columns: list[str], candidates: list[str]) -> str:
    lowered = {column.lower(): column for column in columns}
    for candidate in candidates:
        if candidate in columns:
            return candidate
        found = lowered.get(candidate.lower())
        if found:
            return found
    return ""


def parse_force_plate_csv(file_bytes: bytes) -> dict:
    text = decode_csv_bytes(file_bytes)
    rows = parse_csv_text(text)

    balance_index = next(
        (index for index, row in enumerate(rows) if row and normalize_cell(row[0]) == "バランス評価結果"),
        -1,
    )
    header_indices = [
        index
        for index, row in enumerate(rows)
        if row and normalize_cell(row[0]) in {"", "time"} and "xp" in row and "yp" in row
    ]

    if balance_index < 0 or len(header_indices) < 2:
        raise ValueError("force plate export format not detected")

    metadata: dict[str, Any] = {}
    for row in rows[:balance_index]:
        if len(row) < 2:
            continue
        key = normalize_cell(row[0])
        if not key:
            continue
        metadata[key] = normalize_cell(row[1])

    metric_names = rows[balance_index + 1] if balance_index + 1 < len(rows) else []
    metric_units = rows[balance_index + 2] if balance_index + 2 < len(rows) else []
    metric_values = rows[balance_index + 3] if balance_index + 3 < len(rows) else []
    builtin_metrics: dict[str, Any] = {}
    builtin_metric_units: dict[str, Any] = {}
    for index in range(1, len(metric_names)):
        name = normalize_cell(metric_names[index])
        if not name:
            continue
        builtin_metrics[name] = coerce_cell(metric_values[index] if index < len(metric_values) else "")
        builtin_metric_units[name] = normalize_cell(metric_units[index] if index < len(metric_units) else "")

    stats_header = rows[header_indices[0]]
    stats_columns = ["time" if index == 0 else normalize_cell(column) for index, column in enumerate(stats_header)]
    units_row = rows[header_indices[0] + 1] if header_indices[0] + 1 < len(rows) else []
    min_row = rows[header_indices[0] + 2] if header_indices[0] + 2 < len(rows) else []
    max_row = rows[header_indices[0] + 3] if header_indices[0] + 3 < len(rows) else []
    count_row = rows[header_indices[0] + 4] if header_indices[0] + 4 < len(rows) else []

    units: dict[str, Any] = {}
    stats = {"min": {}, "max": {}, "count": {}}
    for index, column in enumerate(stats_columns):
        units[column] = normalize_cell(units_row[index] if index < len(units_row) else "")
        stats["min"][column] = coerce_cell(min_row[index] if index < len(min_row) else "")
        stats["max"][column] = coerce_cell(max_row[index] if index < len(max_row) else "")
        stats["count"][column] = coerce_cell(count_row[index] if index < len(count_row) else "")

    data_header = rows[header_indices[1]]
    data_columns = ["time" if index == 0 else normalize_cell(column) for index, column in enumerate(data_header)]
    data: list[dict[str, Any]] = []
    for row in rows[header_indices[1] + 1 :]:
        if not row or all(normalize_cell(cell) == "" for cell in row):
            continue
        first = normalize_cell(row[0])
        if first in {"単位", "MIN", "MAX", "データ数"}:
            continue
        item: dict[str, Any] = {}
        for index, column in enumerate(data_columns):
            item[column] = coerce_cell(row[index] if index < len(row) else "")
        data.append(item)

    return {
        "format": "force_plate_export",
        "metadata": metadata,
        "builtin_metrics": builtin_metrics,
        "builtin_metric_units": builtin_metric_units,
        "data_columns": data_columns,
        "units": units,
        "stats": stats,
        "data": data,
        "default_mapping": {
            "time": "time",
            "cop_x": "xp" if "xp" in data_columns else auto_detect_column(data_columns, COP_X_CANDIDATES),
            "cop_y": "yp" if "yp" in data_columns else auto_detect_column(data_columns, COP_Y_CANDIDATES),
            "com_x": "xb" if "xb" in data_columns else "",
            "com_y": "yb" if "yb" in data_columns else "",
        },
    }


def parse_simple_csv(file_bytes: bytes) -> dict:
    text = decode_csv_bytes(file_bytes)
    rows = [row for row in parse_csv_text(text) if any(normalize_cell(cell) for cell in row)]
    if not rows:
        raise ValueError("empty csv")

    header = ["time" if index == 0 and normalize_cell(cell) == "" else normalize_cell(cell) for index, cell in enumerate(rows[0])]
    data: list[dict[str, Any]] = []
    for row in rows[1:]:
        item: dict[str, Any] = {}
        for index, column in enumerate(header):
            item[column] = coerce_cell(row[index] if index < len(row) else "")
        data.append(item)

    return {
        "format": "simple_csv",
        "metadata": {},
        "builtin_metrics": {},
        "builtin_metric_units": {},
        "data_columns": header,
        "units": {},
        "stats": {"min": {}, "max": {}, "count": {}},
        "data": data,
        "default_mapping": {
            "time": auto_detect_column(header, TIME_CANDIDATES),
            "cop_x": auto_detect_column(header, COP_X_CANDIDATES),
            "cop_y": auto_detect_column(header, COP_Y_CANDIDATES),
            "com_x": "xb" if "xb" in header else "",
            "com_y": "yb" if "yb" in header else "",
        },
    }


def parse_any_csv(file_bytes: bytes) -> dict:
    try:
        return parse_force_plate_csv(file_bytes)
    except Exception:
        return parse_simple_csv(file_bytes)


def compute_sway_metrics(
    data: list[dict],
    time_col: str = "time",
    x_col: str = "xp",
    y_col: str = "yp",
) -> dict:
    points: list[tuple[float, float, float]] = []
    for row in data:
        time_value = _to_float(row.get(time_col))
        x_value = _to_float(row.get(x_col))
        y_value = _to_float(row.get(y_col))
        if math.isnan(time_value) or math.isnan(x_value) or math.isnan(y_value):
            continue
        points.append((time_value, x_value, y_value))

    if not points:
        return {
            "sample_count": math.nan,
            "duration": math.nan,
            "sampling_rate_estimated": math.nan,
            "total_path_length": math.nan,
            "mean_velocity": math.nan,
            "max_velocity": math.nan,
            "range_x": math.nan,
            "range_y": math.nan,
            "rms_x": math.nan,
            "rms_y": math.nan,
            "rms_radius": math.nan,
            "rectangle_area": math.nan,
            "ellipse_area_95": math.nan,
            "mean_x": math.nan,
            "mean_y": math.nan,
        }

    xs = [point[1] for point in points]
    ys = [point[2] for point in points]
    times = [point[0] for point in points]
    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)
    duration = max(times) - min(times)

    step_distances: list[float] = []
    step_velocities: list[float] = []
    step_intervals: list[float] = []
    for prev, curr in zip(points, points[1:]):
        dt = curr[0] - prev[0]
        if dt <= 0:
            continue
        distance = math.hypot(curr[1] - prev[1], curr[2] - prev[2])
        step_distances.append(distance)
        step_velocities.append(distance / dt)
        step_intervals.append(dt)

    total_path_length = sum(step_distances) if step_distances else math.nan
    mean_velocity = (total_path_length / duration) if step_distances and duration > 0 else math.nan
    max_velocity = max(step_velocities) if step_velocities else math.nan
    sampling_rate_estimated = (1.0 / statistics.median(step_intervals)) if step_intervals else math.nan

    ellipse_area_95 = _ellipse_area_95(xs, ys, mean_x, mean_y)
    rms_x = math.sqrt(sum((value - mean_x) ** 2 for value in xs) / len(xs))
    rms_y = math.sqrt(sum((value - mean_y) ** 2 for value in ys) / len(ys))

    return {
        "sample_count": float(len(points)),
        "duration": duration,
        "sampling_rate_estimated": sampling_rate_estimated,
        "total_path_length": total_path_length,
        "mean_velocity": mean_velocity,
        "max_velocity": max_velocity,
        "range_x": max(xs) - min(xs),
        "range_y": max(ys) - min(ys),
        "rms_x": rms_x,
        "rms_y": rms_y,
        "rms_radius": math.hypot(rms_x, rms_y),
        "rectangle_area": (max(xs) - min(xs)) * (max(ys) - min(ys)),
        "ellipse_area_95": ellipse_area_95,
        "mean_x": mean_x,
        "mean_y": mean_y,
    }


def analyze_trial(file_bytes: bytes) -> dict:
    parsed = parse_any_csv(file_bytes)
    mapping = parsed.get("default_mapping", {})
    time_col = mapping.get("time", "time")
    cop_x = mapping.get("cop_x", "xp")
    cop_y = mapping.get("cop_y", "yp")

    cop_metrics = compute_sway_metrics(parsed["data"], time_col=time_col, x_col=cop_x, y_col=cop_y)
    com_metrics = None
    com_x = mapping.get("com_x")
    com_y = mapping.get("com_y")
    if com_x and com_y and com_x in parsed["data_columns"] and com_y in parsed["data_columns"]:
      com_metrics = compute_sway_metrics(parsed["data"], time_col=time_col, x_col=com_x, y_col=com_y)

    return {
        "format": parsed.get("format"),
        "metadata": parsed.get("metadata", {}),
        "builtin_metrics": parsed.get("builtin_metrics", {}),
        "builtin_metric_units": parsed.get("builtin_metric_units", {}),
        "columns": parsed.get("data_columns", []),
        "units": parsed.get("units", {}),
        "stats": parsed.get("stats", {}),
        "default_mapping": mapping,
        "cop_metrics": cop_metrics,
        "com_metrics": com_metrics,
        "data_preview": parsed.get("data", [])[:10],
        "data": parsed.get("data", []),
    }


def analyze_trial_from_base64(file_b64: str) -> dict:
    return analyze_trial(base64.b64decode(file_b64))


def analyze_csv_file(csv_path: str | Path, write_metrics_txt: bool = True) -> dict:
    path = Path(csv_path)
    with path.open("rb") as fh:
        result = analyze_trial(fh.read())

    if write_metrics_txt:
        output_path = metrics_txt_path(path)
        output_path.write_text(format_metrics_txt(result, path.name), encoding="utf-8")
        result["metrics_txt_path"] = str(output_path)

    return result


def metrics_txt_path(csv_path: str | Path) -> Path:
    path = Path(csv_path)
    return path.with_name(f"{path.stem}_metrics.txt")


def format_metrics_txt(result: dict, source_name: str = "") -> str:
    lines: list[str] = []
    if source_name:
        lines.extend(["source_file", f"  {source_name}", ""])

    metadata = result.get("metadata") or {}
    if metadata:
        lines.append("metadata")
        for key, value in metadata.items():
            lines.append(f"  {key}: {_format_txt_value(value)}")
        lines.append("")

    builtin_metrics = result.get("builtin_metrics") or {}
    builtin_units = result.get("builtin_metric_units") or {}
    if builtin_metrics:
        lines.append("builtin_metrics")
        for key, value in builtin_metrics.items():
            unit = builtin_units.get(key, "")
            suffix = f" {unit}" if unit else ""
            lines.append(f"  {key}: {_format_txt_value(value)}{suffix}")
        lines.append("")

    _append_metrics_section(lines, "cop_metrics", result.get("cop_metrics"))
    _append_metrics_section(lines, "com_metrics", result.get("com_metrics"))

    return "\n".join(lines).rstrip() + "\n"


def _append_metrics_section(lines: list[str], title: str, metrics: dict | None) -> None:
    if not metrics:
        return
    lines.append(title)
    for key, value in metrics.items():
        lines.append(f"  {key}: {_format_txt_value(value)}")
    lines.append("")


def _format_txt_value(value: Any) -> str:
    if isinstance(value, float):
        if math.isnan(value):
            return "nan"
        return f"{value:.10g}"
    return str(value)


def _to_float(value: Any) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return math.nan
    if math.isnan(result):
        return math.nan
    return result


def _ellipse_area_95(xs: list[float], ys: list[float], mean_x: float, mean_y: float) -> float:
    if len(xs) < 2 or len(ys) < 2:
        return math.nan
    divisor = len(xs) - 1
    if divisor <= 0:
        return math.nan
    var_x = sum((value - mean_x) ** 2 for value in xs) / divisor
    var_y = sum((value - mean_y) ** 2 for value in ys) / divisor
    cov_xy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / divisor
    determinant = (var_x * var_y) - (cov_xy * cov_xy)
    if determinant < 0:
        return math.nan
    return math.pi * 5.991 * math.sqrt(determinant)


def _main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: python balance_analyzer/analysis.py <csv-file>")
        return 1

    target = argv[1]
    result = analyze_csv_file(target, write_metrics_txt=True)

    preview = {
        "metadata": result["metadata"],
        "cop_metrics": result["cop_metrics"],
        "com_metrics": result["com_metrics"],
        "metrics_txt_path": result["metrics_txt_path"],
    }
    print(json.dumps(preview, ensure_ascii=False, indent=2, allow_nan=True))
    return 0


if __name__ == "__main__" and "pyodide" not in sys.modules:
    raise SystemExit(_main(sys.argv))
