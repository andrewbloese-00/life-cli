import { writeFile } from 'fs/promises'
import { db } from  '../db/client.js'
import { convertResults } from '../utils/resultsConvert.js'
import { BuildBudgeting } from './schema.js'
import { ColoredString } from '../utils/coloring.js'

let initialized = false

/**
 * @returns an injectable service that exposes create read and update operations for BudgetItems and BudgetEntries
 */
export const Budgeting = async function _Budgeting(){
    if(!initialized){
        await BuildBudgeting();
        initialized = true
    }


    async function createBudgetItem(name, amount, due=0,description=undefined){
        try {
            const sql = description 
                ? `INSERT INTO BudgetItems( name, amount, due , description) VALUES (? , ? , ? , ?) RETURNING *;` 
                : `INSERT INTO BudgetItems( name, amount, due ) VALUES (? , ? , ?) RETURNING *;`

            const args = description 
                ? [name, amount, due, description] 
                : [name, amount, due]

            const response = await db.execute({sql,args});
            const [budget_item] = convertResults(response)
            if(!budget_item) throw new Error("Unknown Error Occured While Converting Results...");
            return {budget_item}
            
        } catch (error) {
            // console.error("Failed to create new budget entry. Reason: \n", error)
            return { error }
        }
    }

    async function createBudgetEntry(budgetItemId,amount,timestamp=Date.now(), memo=undefined){
        try {
            const sql = memo 
                ? `INSERT INTO BudgetEntries ( budget_item, amount, timestamp , memo ) VALUES (? , ? , ?, ?) RETURNING *;`
                : `INSERT INTO BudgetEntries ( budget_item, amount, timestamp ) VALUES (? , ? , ?) RETURNING *;`
            const args = memo 
                ? [budgetItemId,amount,timestamp,memo]
                : [budgetItemId,amount,timestamp]

            const reply = await db.execute({sql,args})
            const [budget_entry] = convertResults(reply);
            if(!budget_entry) throw new Error("Unknown Error Occured while converting reply...")
            return { budget_entry }
        } catch (error) {
            // console.error("Failed to create new budget entry...\n Reason: ", error);
            return { error }
        }
    }


    async function getBudget(){
        try {
            const reply = await db.execute(`SELECT * FROM BudgetItems ORDER BY amount DESC;`)
            const budget_items = convertResults(reply);
            if(budget_items[0] === null) throw new Error("Unknown Error Occured while converting reply...")
            return { budget_items }

        } catch (error) {
            // console.error("Failed to get budget entries...\n Reason: ", error);
            return { error }
        }
    }


    async function getBudgetsWithProgress(month,year){ 
        const start = new Date(year,month-1,1).getTime()
        
        const endDate = new Date(year,month,0)
        endDate.setHours(23,59,59)
        const end = endDate.getTime()
        
        try {
            const result = await db.execute({
                sql: "SELECT BudgetItems.id, BudgetItems.name, BudgetItems.due, BudgetItems.amount, SUM(BudgetEntries.amount) AS 'progress' FROM BudgetItems LEFT JOIN BudgetEntries ON BudgetItems.id = BudgetEntries.budget_item WHERE BudgetEntries.timestamp BETWEEN ? AND ? GROUP BY BudgetItems.id,BudgetItems.name, BudgetItems.amount, BudgetItems.due ORDER BY BudgetItems.due;",
                args: [start,end]
            })
            const budgets_and_progress = await convertResults(result)
            return { budgets_and_progress }
            
        } catch (error) {
            console.error(`Failed to execute query\n Reason: ${ColoredString(error.message||error, "red")}`)
            return { error }    
        }
    }
    return { createBudgetItem, createBudgetEntry,getBudget,getBudgetsWithProgress }
    
}
