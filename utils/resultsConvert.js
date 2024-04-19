function rowTranslator(columns){
    return (row) => {
        const results = [] 
        if(row.length != columns.length) {
            console.error(`Failed to Convert...\n Got Row with ${row.length} columns -> expected ${columns.length} columns`)
    
        }
        let payload = {}
        for(let i = 0; i < row.length; i++)
            payload[columns[i]] = row[i]

        return payload;

    } 
}


export function convertResults(reply){
    const translator = rowTranslator(reply.columns)
    const converted = [ ]
    if(!reply.rows?.length) return [ null ]
    for(let r = 0; r < reply.rows.length; r++){
        converted.push(translator(reply.rows[r]))
    }
    return converted;
}