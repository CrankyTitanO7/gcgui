import { useEffect, useMemo, useRef, useState } from "react";
import "../App.css";
import { CLEAR_ALL_EVENT } from "../utils/clearAll";
import {
    addFitPoint,
    computeBounds,
    createFitStats,
    fitFromStats,
    formatFitEquation,
    formatFitR,
    formatTick,
    scalePoints,
} from "../utils/plotMath";
import { colorForSeriesIndex } from "../utils/seriesColors";
import { useCANDataHook } from "./parsers/canproc";
import { useCSVDataHook } from "./parsers/csvproc";
import { getCsvDisplayName, resolveCsvCanonical } from "../utils/csvAliases";
import CsvAliasEditor from "./CsvAliasEditor";

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

export default function LinePlotWidget({
    shape,
    mode = "can",
    csvAliases,
    onCsvAliasChange,
    isRecording = false,
    recordingSession = 0,
    dataSource = "live",
}) {
    const { canData } = useCANDataHook();
    const { csvData } = useCSVDataHook();
    const isCSV = mode === "csv";
    const aliases = csvAliases ?? {};
    const displayName = field => (isCSV ? getCsvDisplayName(field, aliases) : field);
    const [selectedField, setSelectedField] = useState(shape.dataField || (isCSV ? "datapoint 1" : "RPM"));
    const selectedCanonical = isCSV ? resolveCsvCanonical(selectedField, aliases) : selectedField;
    const [multiEnabled, setMultiEnabled] = useState(false);
    const [checkedFields, setCheckedFields] = useState(null);
    const [dataByField, setDataByField] = useState({});
    // Best-fit lines are scoped to one recording session: accumulation
    // starts when recording starts (even in live mode, where listening never
    // stops), freezes when recording stops, and clears between sessions.
    const [showFit, setShowFit] = useState(true);
    const fitStatsRef = useRef({});

    // Reset between sessions/modes — declared before the data effect so a
    // session change wipes stale stats before new points can land in them.
    useEffect(() => {
        fitStatsRef.current = {};
    }, [recordingSession, dataSource, isCSV]);

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
    const effectiveField = visibleFields.includes(selectedCanonical)
        ? selectedCanonical
        : (visibleFields[0] ?? selectedCanonical);
    const selectOptions = visibleFields.length > 0 ? visibleFields : [effectiveField];

    // Active series: single selection, or the checked checkbox set in multi mode.
    const activeFields = useMemo(() => {
        if (!multiEnabled) return [effectiveField];
        const list = (checkedFields ?? [effectiveField]).filter(f => f !== "time");
        return [...new Set(list)];
    }, [multiEnabled, checkedFields, effectiveField]);
    const fieldsKey = activeFields.join("\0");

    // Tracks the last processed tick so toggling checkboxes seeds newly added
    // fields without duplicating points for already-tracked ones.
    const lastTickRef = useRef({ canData: null, csvMessage: null, fieldsKey: null });

    useEffect(() => {
        const prev = lastTickRef.current;
        const dataChanged = prev.canData !== canData || prev.csvMessage !== csvMessage;
        let targets;
        if (dataChanged) {
            targets = activeFields;
        } else if (prev.fieldsKey !== fieldsKey) {
            const prevSet = new Set((prev.fieldsKey ?? "").split("\0"));
            targets = activeFields.filter(f => !prevSet.has(f));
        } else {
            return;
        }
        lastTickRef.current = { canData, csvMessage, fieldsKey };
        if (targets.length === 0) return;

        const next = {};
        for (const field of targets) {
            let currentValue = null;
            if (isCSV) {
                const value = fieldValue(csvMessage?.fields?.[field]);
                if (typeof value === "number" && !Number.isNaN(value)) currentValue = value;
            } else {
                Object.values(canData).forEach(message => {
                    const value = fieldValue(message?.fields?.[field]);
                    if (typeof value === "number" && !Number.isNaN(value)) currentValue = value;
                });
            }
            if (currentValue !== null) next[field] = currentValue;
        }
        if (Object.keys(next).length > 0) {
            if (isRecording) {
                const statsMap = fitStatsRef.current;
                for (const [field, value] of Object.entries(next)) {
                    let st = statsMap[field];
                    if (!st) {
                        st = createFitStats();
                        statsMap[field] = st;
                    }
                    addFitPoint(st, value);
                }
            }
            setDataByField(prevData => {
                const out = { ...prevData };
                for (const [field, value] of Object.entries(next)) {
                    out[field] = [...(out[field] ?? []), value].slice(-HISTORY_LIMIT);
                }
                return out;
            });
        }
    }, [canData, csvMessage, fieldsKey, activeFields, isCSV, isRecording]);

    useEffect(() => {
        const handleClearAll = () => {
            setDataByField({});
            fitStatsRef.current = {};
        };
        window.addEventListener(CLEAR_ALL_EVENT, handleClearAll);
        return () => window.removeEventListener(CLEAR_ALL_EVENT, handleClearAll);
    }, []);

    const toggleMulti = () => {
        if (!multiEnabled) setCheckedFields([effectiveField]);
        setMultiEnabled(v => !v);
    };

    const toggleField = field => {
        setCheckedFields(prev => {
            const base = prev ?? [effectiveField];
            return base.includes(field) ? base.filter(f => f !== field) : [...base, field];
        });
    };

    const innerW = PLOT_W - PAD.left - PAD.right;
    const innerH = PLOT_H - PAD.top - PAD.bottom;

    // Solved fits per visible series (O(1) each — stats accumulate online).
    const fitsByField = useMemo(() => {
        const out = {};
        for (const field of activeFields) {
            out[field] = fitFromStats(fitStatsRef.current[field]);
        }
        return out;
        // dataByField ticks whenever stats grow; session/mode reset the stats.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataByField, fieldsKey, recordingSession, dataSource, isCSV]);

    const allValues = activeFields.flatMap(field => dataByField[field] ?? []);
    // Keep the fit segment inside the frame: pad bounds with its endpoints.
    const fitEndpointValues = activeFields.flatMap(field => {
        if (!showFit) return [];
        const f = fitsByField[field];
        if (!f) return [];
        return [f.intercept, f.slope * (f.n - 1) + f.intercept];
    });
    const bounds = computeBounds([...allValues, ...fitEndpointValues]);

    const yToPixel = y => {
        if (!bounds || !(bounds.max > bounds.min)) return innerH / 2;
        return innerH - ((y - bounds.min) / (bounds.max - bounds.min)) * innerH;
    };

    const seriesList = activeFields.map((field, i) => {
        const data = dataByField[field] ?? [];
        const points = bounds && data.length > 0 ? scalePoints(data, innerW, innerH, bounds) : [];
        const linePath =
            points.length === 1
                ? `M 0 ${points[0].y.toFixed(1)} L ${innerW.toFixed(1)} ${points[0].y.toFixed(1)}`
                : points.map((p, k) => `${k === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
        const areaPath =
            points.length > 0
                ? `${linePath} L ${innerW.toFixed(1)} ${innerH.toFixed(1)} L 0 ${innerH.toFixed(1)} Z`
                : "";
        const fit = fitsByField[field] ?? null;
        const fitPath =
            fit && bounds
                ? `M 0 ${yToPixel(fit.intercept).toFixed(1)} L ${innerW.toFixed(1)} ${yToPixel(fit.slope * (fit.n - 1) + fit.intercept).toFixed(1)}`
                : "";
        return {
            field,
            color: colorForSeriesIndex(i),
            data,
            points,
            linePath,
            areaPath,
            lastPoint: points.length > 0 ? points[points.length - 1] : null,
            currentValue: data.length > 0 ? data[data.length - 1] : null,
            fit,
            fitPath,
        };
    });

    const yTickValues =
        bounds != null
            ? Array.from({ length: Y_TICKS }, (_, i) => bounds.min + ((bounds.max - bounds.min) * i) / (Y_TICKS - 1))
            : [];

    const totalPoints = seriesList.reduce((n, s) => n + s.data.length, 0);
    const handleClear = () => {
        setDataByField({});
        fitStatsRef.current = {};
    };
    const single = seriesList[0];

    return (
        <div className="line-widget fill">
            <div className="line-widget-header">
                <div className="widget-name">{shape.name || "Line Plot Widget"}</div>
                <button
                    type="button"
                    className="line-widget-clear"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={handleClear}
                    disabled={totalPoints === 0}
                    title="Clear graph history"
                >
                    Clear
                </button>
            </div>

            {multiEnabled ? (
                <div className="line-widget-legend">
                    {seriesList.map(s => (
                        <span key={s.field} className="line-widget-legend-item">
                            <span className="multi-dot" style={{ background: s.color }} />
                            <span className="line-widget-legend-field">{displayName(s.field)}</span>
                            <span className="line-widget-legend-value">{s.currentValue ?? "N/A"}</span>
                        </span>
                    ))}
                    {bounds && <span className="line-widget-range">{formatTick(bounds.min)} – {formatTick(bounds.max)}</span>}
                </div>
            ) : (
                <div className="line-widget-readout">
                    <span className="line-widget-value">{single?.currentValue ?? "N/A"}</span>
                    <span className="line-widget-field">{displayName(effectiveField)}</span>
                    {bounds && (
                        <span className="line-widget-range">
                            {formatTick(bounds.min)} – {formatTick(bounds.max)}
                        </span>
                    )}
                </div>
            )}

            {showFit && (
                <div className="line-widget-fit">
                    {seriesList.map(s => (
                        <span key={s.field} className="line-widget-fit-row" title={isRecording ? "Best fit over this recording" : "Best fit over the last recording (frozen)"}>
                            <span className="multi-dot" style={{ background: s.color }} />
                            <span className="line-widget-fit-field">{displayName(s.field)}</span>
                            {s.fit ? (
                                <span className="line-widget-fit-eq">
                                    {formatFitEquation(s.fit)} · {formatFitR(s.fit)}
                                </span>
                            ) : (
                                <span className="line-widget-fit-empty">
                                    {isRecording ? "collecting…" : ": no recording data"}
                                </span>
                            )}
                        </span>
                    ))}
                </div>
            )}

            <div className="line-widget-canvas">
                {totalPoints === 0 ? (
                    <div className="line-widget-empty">Waiting for data…</div>
                ) : (
                    <svg viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} className="line-plot-svg" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id={`plot-fill-${shape.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={single?.color ?? "#4caf50"} stopOpacity="0.35" />
                                <stop offset="100%" stopColor={single?.color ?? "#4caf50"} stopOpacity="0.02" />
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
                            {!multiEnabled && single?.areaPath && (
                                <path d={single.areaPath} fill={`url(#plot-fill-${shape.id})`} />
                            )}
                            {seriesList.map(s =>
                                s.linePath ? (
                                    <path
                                        key={s.field}
                                        d={s.linePath}
                                        fill="none"
                                        stroke={s.color}
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                ) : null,
                            )}
                            {showFit &&
                                seriesList.map(s =>
                                    s.fitPath ? (
                                        <path
                                            key={`fit-${s.field}`}
                                            d={s.fitPath}
                                            fill="none"
                                            stroke={s.color}
                                            strokeWidth={1.5}
                                            strokeDasharray="5 4"
                                            opacity={0.9}
                                            strokeLinecap="round"
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    ) : null,
                                )}
                            {seriesList.map(s =>
                                s.lastPoint ? (
                                    <circle key={s.field} cx={s.lastPoint.x} cy={s.lastPoint.y} r={3} fill={s.color} stroke="#0c2213" strokeWidth={1.5} />
                                ) : null,
                            )}
                        </g>
                    </svg>
                )}
            </div>

            <div className="widget-controls">
                <div className="line-widget-controls-row">
                    <label
                        htmlFor={`line-field-select-${shape.id}`}
                        style={{ fontSize: "11px", color: "#888", display: "block" }}
                    >
                        Select Field:
                    </label>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {isCSV && (
                            <CsvAliasEditor fields={selectOptions} aliases={aliases} onAliasChange={onCsvAliasChange} />
                        )}
                        <button
                            type="button"
                            className={`line-widget-multi-toggle${showFit ? " active" : ""}`}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => setShowFit(v => !v)}
                            title={showFit ? "Hide best-fit lines" : "Show best-fit lines"}
                        >
                            {showFit ? "Fit ✓" : "Fit"}
                        </button>
                        <button
                            type="button"
                            className={`line-widget-multi-toggle${multiEnabled ? " active" : ""}`}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={toggleMulti}
                            title={multiEnabled ? "Back to single-line plotting" : "Plot multiple fields at once"}
                        >
                            {multiEnabled ? "Multi ✓" : "Multi"}
                        </button>
                    </div>
                </div>
                {!multiEnabled ? (
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
                                {displayName(field)}
                            </option>
                        ))}
                    </select>
                ) : (
                    <div className="multi-list" onMouseDown={e => e.stopPropagation()}>
                        {selectOptions.map(field => {
                            const idx = activeFields.indexOf(field);
                            const checked = idx !== -1;
                            return (
                                <label key={field} className="multi-option">
                                    <input type="checkbox" checked={checked} onChange={() => toggleField(field)} />
                                    <span className="multi-dot" style={{ background: checked ? colorForSeriesIndex(idx) : "#555" }} />
                                    <span className="multi-option-label">{displayName(field)}</span>
                                </label>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
