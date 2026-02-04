export const api = async <T>(url: string, body: any): Promise<T> => {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.message || "API Request failed");
    return result.data;
};