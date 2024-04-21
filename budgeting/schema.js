import { db } from "../db/client.js";
import { panic } from "../utils/panic.js";


const budgetItemSchema = `
    id integer PRIMARY KEY, name varchar UNIQUE NOT NULL, description text, amount real DEFAULT 0.0, due integer DEFAULT 0
`

const budgetEntrySchema = `
    id integer PRIMARY KEY, budget_item integer REFERENCES BudgetItems(id),  amount real DEFAULT 0.0, memo text, timestamp integer
`


export async function BuildBudgeting(){
    console.log("building budgeting...")
    try {
        const result = await db.batch([
            `CREATE TABLE IF NOT EXISTS BudgetItems (${budgetItemSchema});`,
            `CREATE TABLE IF NOT EXISTS BudgetEntries (${budgetEntrySchema});`,
            `CREATE INDEX IF NOT EXISTS budget_item_name ON BudgetItems(name);`,
            `CREATE INDEX IF NOT EXISTS budget_item_due ON BudgetItems(due);`,
            `CREATE INDEX IF NOT EXISTS budget_item_amount ON BudgetItems(amount);`,
            `CREATE INDEX IF NOT EXISTS budget_entry_timestamp ON BudgetEntries(timestamp);`,
            `CREATE INDEX IF NOT EXISTS budget_entry_amount ON BudgetEntries(amount);`,
        ])
    } catch (error) {
        panic("Failed to initialize Tables and Indexes for Budgeting module\n Reason: " + (error.message||error));
    }
}
