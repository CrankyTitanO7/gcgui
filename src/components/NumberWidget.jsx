import { useState } from "react";
import "../App.css";
import { useCANDataHook } from "./parsers/canproc";
import { useCSVDataHook } from "./parsers/csvproc";
import { getCsvDisplayName, resolveCsvCanonical } from "../utils/csvAliases";
import CsvAliasEditor from "./CsvAliasEditor";

const CAN_FALLBACK_FIELDS = ["RPM", "Throttle", "EngineTemp", "OilPressure", "Voltage", "Current", "Temperature", "SOC"];

// CAN and CSV fields are { value, unit, raw } objects; extract the display value.
const fieldValue = field => field?.value ?? field?.raw ?? null;

const DEFAULT_ALIASES = {};

export default function NumberWidget({ shape, mode = "can", csvAliases = DEFAULT_ALIASES, onCsvAliasChange }) {
    const { canData } = useCANDataHook();
    const { csvData } = useCSVDataHook();
    const isCSV = mode === "csv";

    const [selectedField, setSelectedField] = useState(shape.dataField || (isCSV ? "datapoint 1" : "RPM"));
    // Aliases are display-only; always work with the canonical key internally.
    const selectedCanonical = isCSV ? resolveCsvCanonical(selectedField, csvAliases) : selectedField;

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
    } else {
        Object.values(canData).forEach(message => {
            if (message?.fields) {
                Object.keys(message.fields).forEach(field => {
                    if (!allFields.includes(field)) allFields.push(field);
                });
            }
        });
        if (allFields.length === 0) allFields = CAN_FALLBACK_FIELDS;
    }

    // "time" is the sample clock, not a displayable signal.
    const visibleFields = allFields.filter(field => field !== "time");
    const selectOptions = visibleFields.length > 0 ? visibleFields : allFields;
    // Remap legacy "time" selections to the first available field.
    const effectiveField = selectOptions.includes(selectedCanonical) ? selectedCanonical : selectOptions[0];

    if (isCSV) {
        const value = fieldValue(csvData.csv?.fields?.[effectiveField]);
        if (value != null) currentValue = String(value);
    } else {
        Object.values(canData).forEach(message => {
            const value = fieldValue(message?.fields?.[effectiveField]);
            if (value != null) currentValue = String(value);
        });
    }

    return (
        <div className="number-widget fill">
            <div className="widget-name">{shape.name || "Number Widget"}</div>
            <div className="number-widget-value">{currentValue}</div>
            <div className="widget-controls">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <label htmlFor={`field-select-${shape.id}`} style={{ fontSize: "11px", color: "#888", display: "block" }}>
                        Select Field:
                    </label>
                    {isCSV && (
                        <CsvAliasEditor fields={selectOptions} aliases={csvAliases} onAliasChange={onCsvAliasChange} />
                    )}
                </div>
                <select
                    id={`field-select-${shape.id}`}
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
                            {isCSV ? getCsvDisplayName(field, csvAliases) : field}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
