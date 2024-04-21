import { db } from "../db/client.js";
import { panic } from "../utils/panic.js";
//note: min_max is 0='min' | 1='max' 
// min means that there is a minimum # to reach per day 
// max is a limit on the number of times per day
const habitSchema  = `
    id integer PRIMARY KEY,daily_count integer DEFAULT 1, name varchar UNIQUE NOT NULL,min_max integer DEFAULT 0, color varchar DEFAULT "black"
`.trim();

const habitTallySchema = `date varchar, habit_id integer REFERENCES Habits(id), count integer DEFAULT 1`

export async function BuildHabits(){
    console.log("building habits...")
    try {
        await db.batch([
            `CREATE TABLE IF NOT EXISTS Habits (${habitSchema});`,
            `CREATE TABLE IF NOT EXISTS HabitTallies (${habitTallySchema});`,
            `CREATE INDEX IF NOT EXISTS habits_name_idx ON Habits(name);`, //name index on habits
            `CREATE INDEX IF NOT EXISTS habits_tally_date ON HabitTallies(date);`, //'date' index for habit tallies 
        ])
        
    } catch (error) {
        
        panic("Failed to initialize Tables and Indexes for Habits module. \nREASON:\n" + (error.message || error),1);
    }

}


