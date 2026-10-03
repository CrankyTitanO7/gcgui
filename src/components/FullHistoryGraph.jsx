import { useEffect, useMemo, useState } from "react";
import "../App.css";
import { downsampleSeries, getHistoryFieldNames, getHistorySeries } from "../utils/logHistory";
import { computeBounds, formatTick } from "../utils/plotMath";
import { colorForSeriesIndex } from "../utils/seriesColors";
import { getCsvDisplayName } from "../utils/csvAliases";

const PLOT_W = 900;
const PLOT_H = 380;
const PAD = { left: 56, right: 16, top: 14, bottom: 28 };
const Y_TICKS = 5;

const DEFAULT_ALIASES = {};

export default function FullHistoryGraph({ messages = [], replayCurrentIndex = 0, onSeek, onClose, csvAliases = DEFAULT_ALIASES }) {
    const [selectedField, setSelectedField] = useState(null);
    const [multiEnabled, setMultiEnabled] = useState(false);
    const [checkedFields, setCheckedFields] = useState(null);
    const displayName = field => getCsvDisplayName(field, csvAliases);

    const fieldNames = useMemo(() => getHistoryFieldNames(messages), [messages]);
    const singleField = fieldNames.includes(selectedField) ? selectedField : (fieldNames[0] ?? "");

    // Active series: single selection, or the checked checkbox set in multi mode.
    const activeFields = useMemo(() => {
        if (!multiEnabled) return singleField ? [singleField] : [];
        const list = (checkedFields ?? (singleField ? [singleField] : [])).filter(f => f !== "time");
        return [...new Set(list)];
    }, [multiEnabled, checkedFields, singleField]);

    const seriesByField = useMemo(
        () =>
            activeFields.map((field, i) => {
                const series = getHistorySeries(messages, field);
                return { field, color: colorForSeriesIndex(i), series, rendered: downsampleSeries(series) };
            }),
        [messages, activeFields],
    );

    const allValues = useMemo(() => seriesByField.flatMap(s => s.series.map(p => p.value)), [seriesByField]);
    const bounds = useMemo(() => computeBounds(allValues), [allValues]);

    const total = messages.length;

    // Close on Escape so the modal never traps the user.
    useEffect(() => {
        const onKey = e => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose?.();
            }
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [onClose]);

    const toggleMulti = () => {
        if (!multiEnabled) setCheckedFields(singleField ? [singleField] : []);
        setMultiEnabled(v => !v);
    };

    const toggleField = field => {
        setCheckedFields(prev => {
            const base = prev ?? (singleField ? [singleField] : []);
            return base.includes(field) ? base.filter(f => f !== field) : [...base, field];
        });
    };

    const innerW = PLOT_W - PAD.left - PAD.right;
    const innerH = PLOT_H - PAD.top - PAD.bottom;

    const xForIndex = idx => {
        if (total <= 1) return PAD.left + innerW / 2;
        return PAD.left + (innerW * idx) / (total - 1);
    };
    const yForValue = v => {
        if (!bounds) return PAD.top + innerH / 2;
        return PAD.top + innerH - ((v - bounds.min) / (bounds.max - bounds.min)) * innerH;
    };

    const yTicks = useMemo(() => {
        if (!bounds) return [];
        return Array.from({ length: Y_TICKS }, (_, i) => bounds.min + ((bounds.max - bounds.min) * i) / (Y_TICKS - 1));
    }, [bounds]);

    // Value of each series at (or just before) the replay playhead.
    const playheadValues = useMemo(() => {
        const out = {};
        for (const { field, series } of seriesByField) {
            let value = null;
            for (let i = series.length - 1; i >= 0; i--) {
                if (series[i].index <= replayCurrentIndex) {
                    value = series[i].value;
                    break;
                }
            }
            out[field] = value;
        }
        return out;
    }, [seriesByField, replayCurrentIndex]);

    const totalSamples = seriesByField.reduce((n, s) => n + s.series.length, 0);

    const handlePlotClick = e => {
        if (!onSeek || total === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width <= 0) return;
        // preserveAspectRatio="none" keeps the viewBox mapping linear.
        const svgX = ((e.clientX - rect.left) / rect.width) * PLOT_W;
        const ratio = (svgX - PAD.left) / innerW;
        const idx = Math.round(ratio * (total - 1));
        onSeek(Math.max(0, Math.min(total - 1, idx)));
    };

    return (
        <div className="history-overlay" onClick={onClose}>
            <div className="history-modal" onClick={e => e.stopPropagation()}>
                <div className="history-header">
                    <div>
                        <h3>Full File History</h3>
                        <div className="history-sub">
                            {total} messages
                            {activeFields.length === 1 && totalSamples > 0 && ` · ${totalSamples} samples of ${displayName(activeFields[0])}`}
                            {activeFields.length > 1 && ` · ${activeFields.length} fields`}
                        </div>
                    </div>
                    <button type="button" className="history-close" onClick={onClose} title="Close (Esc)">
                        ✕
                    </button>
                </div>

                <div className="history-controls">
                    {!multiEnabled ? (
                        <>
                            <label htmlFor="history-field-select">Field:</label>
                            <select
                                id="history-field-select"
                                value={singleField}
                                onChange={e => setSelectedField(e.target.value)}
                                disabled={fieldNames.length === 0}
                            >
                                {fieldNames.map(field => (
                                    <option key={field} value={field}>
                                        {displayName(field)}
                                    </option>
                                ))}
                            </select>
                        </>
                    ) : (
                        <div className="multi-list history-multi-list">
                            {fieldNames.map(field => {
                                const idx = activeFields.indexOf(field);
                                const checked = idx !== -1;
                                return (
                                    <label key={field} className="multi-option">
                                        <input type="checkbox" checked={checked} onChange={() => toggleField(field)} />
                                        <span className="multi-dot" style={{ background: checked ? colorForSeriesIndex(idx) : "#555" }} />
                                        <span className="multi-option-label">{displayName(field)}</span>
                                        <span className="multi-option-value">
                                            {playheadValues[field] ?? "—"}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                    <button
                        type="button"
                        className={`line-widget-multi-toggle${multiEnabled ? " active" : ""}`}
                        onClick={toggleMulti}
                        title={multiEnabled ? "Back to single-line plotting" : "Plot multiple fields at once"}
                    >
                        {multiEnabled ? "Multi ✓" : "Multi"}
                    </button>
                    <span className="history-hint">Click the graph to seek replay</span>
                </div>

                <div className="history-canvas">
                    {totalSamples === 0 || !bounds ? (
                        <div className="line-widget-empty">
                            {fieldNames.length === 0 ? "No plottable numeric fields in this file." : "No numeric samples for the selected field(s)."}
                        </div>
                    ) : (
                        <svg viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} className="line-plot-svg history-svg" preserveAspectRatio="none" onClick={handlePlotClick}>
                            {yTicks.map((tick, i) => {
                                const y = yForValue(tick);
                                return (
                                    <g key={`h-${i}`}>
                                        <line
                                            x1={PAD.left}
                                            y1={y}
                                            x2={PLOT_W - PAD.right}
                                            y2={y}
                                            className={i === 0 || i === yTicks.length - 1 ? "gridline-edge" : "gridline"}
                                        />
                                        <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="gridlabel">
                                            {formatTick(tick)}
                                        </text>
                                    </g>
                                );
                            })}

                            <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} className="plot-frame" />

                            {seriesByField.map(({ field, color, rendered }) => {
                                if (rendered.length === 0) return null;
                                const d = rendered
                                    .map(p => `${p === rendered[0] ? "M" : "L"} ${xForIndex(p.index).toFixed(1)} ${yForValue(p.value).toFixed(1)}`)
                                    .join(" ");
                                return (
                                    <path
                                        key={field}
                                        d={d}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                );
                            })}

                            {/* Replay playhead */}
                            {total > 0 && (
                                <g>
                                    <line
                                        x1={xForIndex(replayCurrentIndex)}
                                        y1={PAD.top}
                                        x2={xForIndex(replayCurrentIndex)}
                                        y2={PAD.top + innerH}
                                        className="history-playhead"
                                    />
                                    {seriesByField.map(({ field, color }) => {
                                        const value = playheadValues[field];
                                        if (value === null || value === undefined) return null;
                                        return (
                                            <circle
                                                key={field}
                                                cx={xForIndex(replayCurrentIndex)}
                                                cy={yForValue(value)}
                                                r={4}
                                                fill={color}
                                                stroke="#0c2213"
                                                strokeWidth={1.5}
                                            />
                                        );
                                    })}
                                </g>
                            )}
                        </svg>
                    )}
                </div>

                {bounds && (
                    <div className="history-range">
                        min {formatTick(bounds.min)} · max {formatTick(bounds.max)}
                    </div>
                )}
            </div>
        </div>
    );
}
