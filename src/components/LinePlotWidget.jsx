import { useEffect, useState } from "react";
import "../App.css";
// import BMSStatusWidget from "./components/BMS";

function LinePlotWidget({ shape }) {
    const { canData } = useCANDataHook();
    const [selectedField, setSelectedField] = useState(shape.dataField || "RPM");
    const [dataPoints, setDataPoints] = useState([]);

    const allFields = [];
    Object.values(canData).forEach(message => {
        if (message?.fields) {
            Object.keys(message.fields).forEach(field => {
                if (!allFields.includes(field)) allFields.push(field);
            });
        }
    });

    useEffect(() => {
        let currentValue = null;
        Object.values(canData).forEach(message => {
            if (message?.fields?.[selectedField] != null) currentValue = message.fields[selectedField];
        });
        if (currentValue !== null) {
            setDataPoints(prev => [...prev, currentValue].slice(-16));
        }
    }, [canData, selectedField]);

    const generatePoints = data => {
        if (data.length === 0) return "";
        const max = Math.max(...data);
        const min = Math.min(...data);
        return data
            .map((point, index) => {
                const x = (index / Math.max(data.length - 1, 1)) * 100;
                const y = max === min ? 50 : 100 - ((point - min) / (max - min)) * 100;
                return `${x},${y}`;
            })
            .join(" ");
    };

    const generateGridlines = () => {
        const elements = [];
        const data = dataPoints.length > 0 ? dataPoints : [0];
        const max = Math.max(...data);
        const min = Math.min(...data);

        for (let i = 0; i <= 10; i++) {
            elements.push(
                <line key={`v-${i}`} x1={(i / 10) * 100} y1="0" x2={(i / 10) * 100} y2="100" className="gridline" />,
            );
        }
        for (let i = 0; i <= 10; i++) {
            const y = (i / 10) * 100;
            elements.push(<line key={`h-${i}`} x1="0" y1={y} x2="100" y2={y} className="gridline" />);
            if (max !== min) {
                elements.push(
                    <text key={`h-label-${i}`} x="2" y={y + 3} className="gridlabel" fontSize="4" fill="#666">
                        {Math.round(min + (max - min) * (1 - i / 10))}
                    </text>,
                );
            } else if (i === 5) {
                elements.push(
                    <text key="h-label-center" x="2" y={y + 3} className="gridlabel" fontSize="4" fill="#666">
                        {Math.round(max)}
                    </text>,
                );
            }
        }
        return elements;
    };

    const currentValue = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : "N/A";

    return (
        <div className="line-widget fill">
            <div className="widget-name">{shape.name || "Line Plot Widget"}</div>
            <div className="line-widget-canvas">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="line-plot-svg">
                    {generateGridlines()}
                    <polyline points={generatePoints(dataPoints)} className="line-plot-path" />
                </svg>
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
                    value={selectedField}
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
                    {allFields.map(field => (
                        <option key={field} value={field}>
                            {field}
                        </option>
                    ))}
                </select>
            </div>
            <div className="widget-field">
                {selectedField ? `${selectedField}:` : "Value:"} {currentValue}
            </div>
        </div>
    );
}
