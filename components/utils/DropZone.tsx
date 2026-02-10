"use client";

import React from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';

const CSVDropzone: React.FC<{ onDataParsed: (data: { header?: string[]; data: unknown[] }) => void }> = ({ onDataParsed }) => {
    interface ParseResult {
        data: unknown[];
        errors: Papa.ParseError[];
        meta: Papa.ParseMeta;
    }

    const onDrop = (acceptedFiles: File[]): void => {
        // Ensure only one file is processed
        if (acceptedFiles.length === 0) return;

        const file = acceptedFiles[0];
        const reader = new FileReader();

        reader.onload = (e: ProgressEvent<FileReader>): void => {
            const csv = e.target?.result as string;
            Papa.parse<unknown>(csv, {
                header: true, // Assuming the CSV has a header row
                dynamicTyping: true, // Attempt to convert numeric strings to numbers
                skipEmptyLines: true, // Skip empty lines in the CSV
                complete: (results: ParseResult): void => {
                    onDataParsed({ header: results.meta?.fields, data: results.data });
                },
                error: (error: Error, file: File): void => {
                    console.error("Error parsing CSV:", error);
                }
            });
        };

        reader.readAsText(file);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
        }
    });

    return (
        <div {...getRootProps()} style={dropzoneStyles}
            className={`min-h-40 flex text-stone-400 justify-center items-center rounded-lg transition-colors
            border-2 border-dashed border-stone-600 ${isDragActive ? "bg-tangerine/10" : "hover:border-tangerine"}`}>
            <input {...getInputProps()} />
            {
                isDragActive
                    ? <p >Drop the CSV file here ...</p>
                    : <p >Drop a CSV file or click to select file</p>
            }
        </div>
    );
}

const dropzoneStyles: React.CSSProperties = {
    cursor: 'pointer'
};

export default CSVDropzone;
