import { writeFile } from 'fs/promises'
import { db } from  '../db/client.js'
import { convertResults } from '../utils/resultsConvert.js'
import { BuildBudgeting } from './schema.js'

let initialized = false
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

    async function createBudgetEntry(budgetItemId,amount,due=Date.now(), memo=undefined){
        try {
            const sql = memo 
                ? `INSERT INTO BudgetEntries ( budget_item, amount, due , memo ) VALUES (? , ? , ?, ?) RETURNING *;`
                : `INSERT INTO BudgetEntries ( budget_item, amount, due ) VALUES (? , ? , ?) RETURNING *;`
            const args = memo 
                ? [budgetItemId,amount,due,memo]
                : [budgetItemId,amount,due]

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
            const reply = await db.execute(`SELECT * FROM BudgetItems ORDER_BY amount DESC;`)
            const budget_items = convertResults(reply);
            if(budget_items[0] === null) throw new Error("Unknown Error Occured while converting reply...")
            return { budget_items }

        } catch (error) {
            // console.error("Failed to get budget entries...\n Reason: ", error);
            return { error }
        }
    }


    async function getBudgetsWithProgress(constraints=undefined){ 
        if( constraints ){


        } else { 
            // all time 

        }
    
    }






    return { createBudgetItem, createBudgetEntry }
   
    

    
}
