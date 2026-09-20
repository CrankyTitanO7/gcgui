import { useState } from "react";
import "../App.css";
// import BMSStatusWidget from "./components/BMS";

function NumberWidget({ shape }) {
    const { canData } = useCANDataHook();
    const [selectedField, setSelectedField] = useState(shape.dataField || "RPM");

    const allFields = [];
    Object.values(canData).forEach(message => {
        if (message?.fields) {
            Object.keys(message.fields).forEach(field => {
                if (!allFields.includes(field)) allFields.push(field);
            });
        }
    });

    let currentValue = "N/A";
    Object.values(canData).forEach(message => {
        if (message?.fields?.[selectedField] != null) currentValue = message.fields[selectedField];
    });

    const availableFields =
        allFields.length > 0
            ? allFields
            : ["RPM", "Throttle", "EngineTemp", "OilPressure", "Voltage", "Current", "Temperature", "SOC"];

    return (
        <div className="number-widget fill">
            <div className="widget-name">{shape.name || "Number Widget"}</div>
            <div className="number-widget-value">{currentValue}</div>
            <div className="widget-controls">
                <label
                    htmlFor={`field-select-${shape.id}`}
                    style={{ fontSize: "11px", color: "#888", marginBottom: "4px", display: "block" }}
                >
                    Select Field:
                </label>
                <select
                    id={`field-select-${shape.id}`}
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
                    {availableFields.map(field => (
                        <option key={field} value={field}>
                            {field}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
