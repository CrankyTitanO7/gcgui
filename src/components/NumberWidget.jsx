import { useState } from "react";
import "../App.css";
import { useCANDataHook } from "./parsers/canproc";
import { useCSVDataHook } from "./parsers/csvproc";

const CAN_FALLBACK_FIELDS = ["RPM", "Throttle", "EngineTemp", "OilPressure", "Voltage", "Current", "Temperature", "SOC"];

// CAN and CSV fields are { value, unit, raw } objects; extract the display value.
const fieldValue = field => field?.value ?? field?.raw ?? null;

export default function NumberWidget({ shape, mode = "can" }) {
    const { canData } = useCANDataHook();
    const { csvData } = useCSVDataHook();
    const isCSV = mode === "csv";

    const [selectedField, setSelectedField] = useState(shape.dataField || (isCSV ? "datapoint 1" : "RPM"));

    if (mode !== "can" && mode !== "csv") {
        return (
            <div className="number-widget fill">
                <div className="widget-name">{shape.name || "Number Widget"}</div>
                <div className="number-widget-value">invalid mode</div>
            </div>
        );
    }

    let allFields = [];
    let currentValue = "N/A";

    if (isCSV) {
        const fields = csvData.csv?.fields ?? {};
        allFields = Object.keys(fields);
        if (allFields.length === 0) allFields = ["datapoint 1"];
        const value = fieldValue(fields[selectedField]);
        if (value != null) currentValue = String(value);
    } else {
        Object.values(canData).forEach(message => {
            if (message?.fields) {
                Object.keys(message.fields).forEach(field => {
                    if (!allFields.includes(field)) allFields.push(field);
                });
            }
        });
        Object.values(canData).forEach(message => {
            const value = fieldValue(message?.fields?.[selectedField]);
            if (value != null) currentValue = String(value);
        });
        if (allFields.length === 0) allFields = CAN_FALLBACK_FIELDS;
    }

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
                    {allFields.map(field => (
                        <option key={field} value={field}>
                            {field}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
