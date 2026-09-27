import { useEffect, useMemo, useState } from "react";
import "../App.css";
import { downsampleSeries, getHistoryFieldNames, getHistorySeries } from "../utils/logHistory";
import { computeBounds, formatTick } from "../utils/plotMath";

const PLOT_W = 900;
const PLOT_H = 380;
const PAD = { left: 56, right: 16, top: 14, bottom: 28 };
const Y_TICKS = 5;

export default function FullHistoryGraph({ messages = [], replayCurrentIndex = 0, onSeek, onClose }) {
    const [selectedField, setSelectedField] = useState(null);

    const fieldNames = useMemo(() => getHistoryFieldNames(messages), [messages]);
    const effectiveField = fieldNames.includes(selectedField) ? selectedField : (fieldNames[0] ?? "");

    const series = useMemo(() => getHistorySeries(messages, effectiveField), [messages, effectiveField]);
    const values = useMemo(() => series.map(p => p.value), [series]);
    const bounds = useMemo(() => computeBounds(values), [values]);
    const rendered = useMemo(() => downsampleSeries(series), [series]);

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

    const linePath = rendered.map(p => `${p === rendered[0] ? "M" : "L"} ${xForIndex(p.index).toFixed(1)} ${yForValue(p.value).toFixed(1)}`).join(" ");

    const yTicks = useMemo(() => {
        if (!bounds) return [];
        return Array.from({ length: Y_TICKS }, (_, i) => bounds.min + ((bounds.max - bounds.min) * i) / (Y_TICKS - 1));
    }, [bounds]);

    // Value at (or just before) the replay playhead.
    let playheadValue = null;
    for (let i = series.length - 1; i >= 0; i--) {
        if (series[i].index <= replayCurrentIndex) {
            playheadValue = series[i].value;
            break;
        }
    }

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
                            {series.length > 0 && ` · ${series.length} samples of ${effectiveField}`}
                            {playheadValue !== null && ` · @playhead ${formatTick(playheadValue)}`}
                        </div>
                    </div>
                    <button type="button" className="history-close" onClick={onClose} title="Close (Esc)">
                        ✕
                    </button>
                </div>

                <div className="history-controls">
                    <label htmlFor="history-field-select">Field:</label>
                    <select
                        id="history-field-select"
                        value={effectiveField}
                        onChange={e => setSelectedField(e.target.value)}
                        disabled={fieldNames.length === 0}
                    >
                        {fieldNames.map(field => (
                            <option key={field} value={field}>
                                {field}
                            </option>
                        ))}
                    </select>
                    <span className="history-hint">Click the graph to seek replay</span>
                </div>

                <div className="history-canvas">
                    {series.length === 0 || !bounds ? (
                        <div className="line-widget-empty">
                            {fieldNames.length === 0 ? "No plottable numeric fields in this file." : "No numeric samples for this field."}
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

                            {linePath && <path d={linePath} className="line-plot-path" vectorEffect="non-scaling-stroke" />}

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
                                    {playheadValue !== null && (
                                        <circle cx={xForIndex(replayCurrentIndex)} cy={yForValue(playheadValue)} r={4} className="line-plot-dot" />
                                    )}
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
