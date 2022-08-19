export function parse(excluded: string, variables: any): string[] {
    if (excluded == "") {
        return []
    } 
    let addList = excluded.replace(" ", "").split("+")
    let toAdd: string[] = []
    addList.forEach(i => {
        if (i.startsWith("\"") && i.endsWith("\"")) {
            toAdd.push(i)
        } else if (i.startsWith("var(") && i.endsWith(")")) {
            for (let item in variables[i.substring(4, i.length - 1)]) {
                toAdd.push(item)
            }
        } else {
            throw new Error("Invalid Code Syntax")
        }
    })
    return toAdd
}