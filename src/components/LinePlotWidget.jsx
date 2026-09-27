import { useEffect, useState } from "react";
import "../App.css";
import { CLEAR_ALL_EVENT } from "../utils/clearAll";
import { computeBounds, formatTick, scalePoints } from "../utils/plotMath";
import { useCANDataHook } from "./parsers/canproc";
import { useCSVDataHook } from "./parsers/csvproc";

// CAN and CSV fields are { value, unit, raw } objects; extract the display value.
const fieldValue = field => field?.value ?? field?.raw ?? null;

// "time" is the sample clock, not a plottable signal.
const isPlottableField = name => name !== "time";

const HISTORY_LIMIT = 60;
const PLOT_W = 320;
const PLOT_H = 150;
const PAD = { left: 40, right: 10, top: 10, bottom: 16 };
const Y_TICKS = 4;
const X_LINES = 6;

export default function LinePlotWidget({ shape, mode = "can" }) {
    const { canData } = useCANDataHook();
    const { csvData } = useCSVDataHook();
    const isCSV = mode === "csv";
    const [selectedField, setSelectedField] = useState(shape.dataField || (isCSV ? "datapoint 1" : "RPM"));
    const [dataPoints, setDataPoints] = useState([]);

    const csvMessage = isCSV ? csvData.csv : undefined;
    const csvFieldNames = Object.keys(csvMessage?.fields ?? {});
    const allFields = isCSV
        ? csvFieldNames.length > 0
            ? csvFieldNames
            : ["datapoint 1"]
        : (() => {
              const names = [];
              Object.values(canData).forEach(message => {
                  if (message?.fields) {
                      Object.keys(message.fields).forEach(field => {
                          if (!names.includes(field)) names.push(field);
                      });
                  }
              });
              return names;
          })();

    const visibleFields = allFields.filter(isPlottableField);
    // Remap legacy "time" selections (or fields with no data yet) to the
    // first available plottable field.
    const effectiveField = visibleFields.includes(selectedField)
        ? selectedField
        : (visibleFields[0] ?? selectedField);
    const selectOptions = visibleFields.length > 0 ? visibleFields : [effectiveField];

    useEffect(() => {
        let currentValue = null;
        if (isCSV) {
            const value = fieldValue(csvMessage?.fields?.[effectiveField]);
            if (typeof value === "number" && !Number.isNaN(value)) currentValue = value;
        } else {
            Object.values(canData).forEach(message => {
                const value = fieldValue(message?.fields?.[effectiveField]);
                if (typeof value === "number" && !Number.isNaN(value)) currentValue = value;
            });
        }
        if (currentValue !== null) {
            setDataPoints(prev => [...prev, currentValue].slice(-HISTORY_LIMIT));
        }
    }, [canData, csvMessage, effectiveField, isCSV]);

    useEffect(() => {
        const handleClearAll = () => setDataPoints([]);
        window.addEventListener(CLEAR_ALL_EVENT, handleClearAll);
        return () => window.removeEventListener(CLEAR_ALL_EVENT, handleClearAll);
    }, []);

    const innerW = PLOT_W - PAD.left - PAD.right;
    const innerH = PLOT_H - PAD.top - PAD.bottom;
    const bounds = computeBounds(dataPoints);
    const points = bounds ? scalePoints(dataPoints, innerW, innerH, bounds) : [];

    const linePath =
        points.length === 1
            ? `M 0 ${points[0].y.toFixed(1)} L ${innerW.toFixed(1)} ${points[0].y.toFixed(1)}`
            : points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const areaPath =
        points.length > 0
            ? `${linePath} L ${innerW.toFixed(1)} ${innerH.toFixed(1)} L 0 ${innerH.toFixed(1)} Z`
            : "";
    const lastPoint = points.length > 0 ? points[points.length - 1] : null;

    const yTickValues =
        bounds != null
            ? Array.from({ length: Y_TICKS }, (_, i) => bounds.min + ((bounds.max - bounds.min) * i) / (Y_TICKS - 1))
            : [];

    const currentValue = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : null;

    const handleClear = () => setDataPoints([]);

    return (
        <div className="line-widget fill">
            <div className="line-widget-header">
                <div className="widget-name">{shape.name || "Line Plot Widget"}</div>
                <button
                    type="button"
                    className="line-widget-clear"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={handleClear}
                    disabled={dataPoints.length === 0}
                    title="Clear graph history"
                >
                    Clear
                </button>
            </div>

            <div className="line-widget-readout">
                <span className="line-widget-value">{currentValue ?? "N/A"}</span>
                <span className="line-widget-field">{effectiveField}</span>
                {bounds && (
                    <span className="line-widget-range">
                        {formatTick(bounds.min)} – {formatTick(bounds.max)}
                    </span>
                )}
            </div>

            <div className="line-widget-canvas">
                {points.length === 0 ? (
                    <div className="line-widget-empty">Waiting for data…</div>
                ) : (
                    <svg viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} className="line-plot-svg" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id={`plot-fill-${shape.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#4caf50" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="#4caf50" stopOpacity="0.02" />
                            </linearGradient>
                        </defs>

                        {/* Horizontal gridlines + y labels */}
                        {yTickValues.map((tick, i) => {
                            const y = PAD.top + innerH - ((tick - bounds.min) / (bounds.max - bounds.min)) * innerH;
                            return (
                                <g key={`h-${i}`}>
                                    <line
                                        x1={PAD.left}
                                        y1={y}
                                        x2={PLOT_W - PAD.right}
                                        y2={y}
                                        className={i === 0 || i === yTickValues.length - 1 ? "gridline-edge" : "gridline"}
                                    />
                                    <text x={PAD.left - 5} y={y + 3} textAnchor="end" className="gridlabel">
                                        {formatTick(tick)}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Vertical gridlines */}
                        {Array.from({ length: X_LINES }, (_, i) => {
                            const x = PAD.left + (innerW * i) / (X_LINES - 1);
                            return <line key={`v-${i}`} x1={x} y1={PAD.top} x2={x} y2={PAD.top + innerH} className="gridline" />;
                        })}

                        {/* Plot frame */}
                        <rect
                            x={PAD.left}
                            y={PAD.top}
                            width={innerW}
                            height={innerH}
                            className="plot-frame"
                        />

                        <g transform={`translate(${PAD.left},${PAD.top})`}>
                            {areaPath && <path d={areaPath} fill={`url(#plot-fill-${shape.id})`} />}
                            {linePath && <path d={linePath} className="line-plot-path" vectorEffect="non-scaling-stroke" />}
                            {lastPoint && <circle cx={lastPoint.x} cy={lastPoint.y} r={3} className="line-plot-dot" />}
                        </g>
                    </svg>
                )}
            </div>

            <div className="widget-controls">
                <label
                    htmlFor={`line-field-select-${shape.id}`}
                    style={{ fontSize: "11px", color: "#888", marginBottom: "4px", display: "block" }}
                >
                    Select Field:
                </label>
                <select
                    id={`line-field-select-${shape.id}`}
                    value={effectiveField}
                    onChange={e => setSelectedField(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "1px solid #444",
                        background: "#2a2a2a",
                        color: "#fff",
                        fontSize: "12px",
                    }}
                >
                    {selectOptions.map(field => (
                        <option key={field} value={field}>
                            {field}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
