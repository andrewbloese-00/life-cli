export function panic(message,code=1){
    console.error(`!PANIC [${code}] `,message)
    process.exit(code)
}