// This service handles interactions with the iLovePDF API
// API Config: https://developer.ilovepdf.com/docs/api-reference

interface AuthResponse {
    token: string;
}

interface StartResponse {
    server: string;
    task: string;
}

interface UploadResponse {
    server_filename: string;
}

interface ProcessResponse {
    download_filename: string;
    filesize: number;
    output_filesize: number;
    output_filenumber: number;
    output_extensions: string[];
    timer: string;
    status: string;
}

export const convertWithILovePDF = async (
    fileDataUrl: string,
    fileName: string,
    tool: string, // e.g., 'pdfexcel', 'pdfword', 'officepdf'
    publicKey: string,
    secretKey: string
): Promise<{ data: string, filename: string, mimeType: string }> => {
    
    // Helper to convert dataURL to Blob
    const dataURLtoBlob = (dataurl: string) => {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)![1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    };

    const fileBlob = dataURLtoBlob(fileDataUrl);

    try {
        // 1. Auth - Get Token
        const authRes = await fetch('https://api.ilovepdf.com/v1/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ public_key: publicKey })
        });
        
        if (!authRes.ok) throw new Error('Auth failed. Check Public Key.');
        const authData: AuthResponse = await authRes.json();
        const token = authData.token;

        // 2. Start Task
        const startRes = await fetch(`https://api.ilovepdf.com/v1/start/${tool}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!startRes.ok) throw new Error('Start task failed.');
        const startData: StartResponse = await startRes.json();
        const { server, task } = startData;

        // 3. Upload File
        const formData = new FormData();
        formData.append('task', task);
        formData.append('file', fileBlob, fileName);

        const uploadRes = await fetch(`https://${server}/v1/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (!uploadRes.ok) throw new Error('Upload failed.');
        const uploadData: UploadResponse = await uploadRes.json();
        const { server_filename } = uploadData;

        // 4. Process File
        const processBody = {
            task: task,
            tool: tool,
            files: [{ server_filename: server_filename, filename: fileName }],
            // Add other parameters if needed based on tool
        };

        const processRes = await fetch(`https://${server}/v1/process`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(processBody)
        });

        if (!processRes.ok) throw new Error('Process failed.');
        const processData: ProcessResponse = await processRes.json();
        // iLovePDF processing is async but the process endpoint often waits? 
        // Docs say process returns info, then we download.

        // 5. Download File
        const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!downloadRes.ok) throw new Error('Download failed.');
        const downloadBlob = await downloadRes.blob();
        
        // Convert Blob to Base64/DataURL for our app to handle
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result as string;
                resolve({
                    data: base64data,
                    filename: `converted_${fileName.split('.')[0]}.${tool === 'pdfexcel' ? 'xlsx' : tool === 'pdfword' ? 'docx' : 'pdf'}`, // Simple extension guess
                    mimeType: downloadBlob.type
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(downloadBlob);
        });

    } catch (error) {
        console.error("iLovePDF Service Error:", error);
        throw error;
    }
};