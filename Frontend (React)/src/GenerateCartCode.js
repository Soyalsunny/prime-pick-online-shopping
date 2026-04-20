function generateRandomAlpanumerice(length = 10) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++){
        const randomIndex = Math.floor(Math.random() * characters.length)
        result += characters[randomIndex];
    }
    return result
}

export function generateCartCode(length = 10) {
    return generateRandomAlpanumerice(length)
}

export const randomValue = generateRandomAlpanumerice();