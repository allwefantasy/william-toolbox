import axios from 'axios';
import Papa from 'papaparse';

interface CSVRow {
    [key: string]: string | number | boolean | null;
}

interface CSVMeta {
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    truncated: boolean;
    cursor: number;
    fields?: string[];
}

export const detectAndHandleCSV = async (message: string, skipCSVCheck: boolean) => {
    try {
        const response = await axios.post('/chat/extract_csv', {
            content: message
        });
        const csvContent = response.data.csv_content;
        
        if (!csvContent && !skipCSVCheck) {
            const askResponse = await ask(`下面是用户提供的信息：\n${message} \n\n请判断以下内容是否包含 CSV 表格数据，只需回答是或否`);
            if (askResponse !== "否") {
                return {
                    shouldHandle: false,
                    showCSVWarning: true
                };
            }
        }

        if (csvContent) {
            const parsedData: { data: CSVRow[]; meta: CSVMeta } = Papa.parse(csvContent, {
                delimiter: ',',
                newline: '\n',
                skipEmptyLines: true,
                dynamicTyping: true,
                header: true            
            });

            const totalCells = parsedData.data.length * Object.keys(parsedData.data[0] || {}).length;
            if (totalCells > 500) {
                return {
                    shouldHandle: false,
                    showCSVPreview: true,
                    csvData: parsedData.data,
                    csvMeta: parsedData.meta,
                    pendingMessage: message
                };
            }
        }

        return {
            shouldHandle: true
        };
    } catch (error) {
        console.error('Error detecting CSV:', error);
        return {
            shouldHandle: true
        };
    }
};

const ask = async (message: string) => {
    try {
        const response = await axios.post('/chat/ask', {
            message: message
        });
        return response.data.response;
    } catch (error) {
        console.error('Error in ask:', error);
        throw error;
    }
};