import { writeFile } from "fs/promises";
import { db } from "../db/client.js";
import { convertResults } from "../utils/resultsConvert.js";
import { BuildHabits } from "./schema.js";

Date.prototype.toHabitDateString = function () {
  const yyyy = this.getFullYear();
  const mm = `${this.getMonth() + 1}`.padStart(2, "0");
  const dd = `${this.getDate()}`.padStart(2, "0");
  const hrs = `${this.getHours()}`.padStart(2, "0");
  const mins = `${this.getHours()}`.padStart(2, "0");
  const date = `${yyyy}-${mm}-${dd}T${hrs}:${mins}`;
  return date;
};





// exposs Habit API functions
// - getHabits -> returns all the habits stored in the database
// - addHabit -> creates a habit in the database and returns it in object form.
// - tallyHabit -> adds tally with value 'count', to some HabitTallies table, referencing some 'habitId'
// -
export const Habits = async function _Habits() {
  if (!Habits.isInitialized) {
    await BuildHabits();
    Habits.isInitialized = true;
  }

  async function getHabits() {
    try {
      const reply = await db.execute(`SELECT * FROM habits ORDER BY id;`);
      return { habits: convertResults(reply) };
    } catch (error) {
      return { error };
    }
  }

  async function addHabit(name, daily_count,min_max=0,color="black") {
    try {
      const reply = await db.execute({
        sql: `INSERT INTO Habits (name,daily_count,min_max,color) VALUES (?,?,?,?) RETURNING *;`,
        args: [name,daily_count,min_max,color]
      });
      const [habitObject] = convertResults(reply);
      return { habit: habitObject };
    } catch (error) {
      console.error("Failed to add habit! Reason:\n", error);
      return { error };
    }
  }

  async function tallyHabit(habitId, count = 1) {
    const date = new Date().toHabitDateString();

    try {
      const reply = await db.execute({
        sql: `INSERT INTO HabitTallies (date,habit_id,count) VALUES (?,?,?) RETURNING *`,
        args: [date, habitId, count],
      });
      const [habitTally] = convertResults(reply);
      return { habitTally };
    } catch (error) {
      console.error("Failed to tallyHabit! Reason:\n", error);
      return { error };
    }
  }

  async function getTalliesOn(date) {
    let d = date;
    if (date instanceof Date) {
      d = date.toHabitDateString().split("T")[0];
    }

    try {
      const reply = await db.execute({
        sql: `SELECT H.name, H.daily_count, H.id, H.color, SUM(T.count) as 'Progress' FROM Habits H JOIN HabitTallies T ON H.id = T.habit_id WHERE substr(T.date,1,10)=? GROUP BY H.name, H.id ORDER BY H.id`,
        args: [d],
      });
      
      const tallies = convertResults(reply)
      return { tallies }

    } catch (error) {
      console.error("Failed to getTalliesOn, Reason:\n", error);
      return { error };
    }
  }

  /**
   *
   * @param {number} habitId
   * @param {{name?: string, daily_count?: number}} updates
   */
  async function editHabit(habitId, updates) {

    let ud = [], args = []
    if(updates.daily_count) {
      ud.push("daily_count=?")
      args.push(updates.daily_count)
    }
    if(updates.name) {
      ud.push("name=?")
      args.push(updates.name)
    }
    if(updates.min_max){
      ud.push("min_max=?")
      args.push(updates.min_max)
    }

    if(updates.color){
      ud.push("color=?")
      args.push(updates.color)
    }

    args.push(habitId)
    const response = await db.execute({
      sql: `UPDATE Habits SET ${ud.join(",")} WHERE id=? RETURNING *;`,
      args
    })
    try {
        const [ habit ] = convertResults(response)
        return { habit }


    } catch (error) {
      console.error("Failed to 'editHabit'... Reason: \n",error)
      return { error }
    }
     

    

    


   
  }

  /**
   * @param {number} habitId the id of the habit to delete
   */
  async function deleteHabit(habitId) {
    try {
      const reply = await db.batch([
        { sql: "DELETE FROM HabitTallies WHERE habit_id=?", args: [habitId] },
        { sql: "DELETE FROM Habits WHERE id = ?", args: [habitId] },
      ]);

      let count = 0;
      reply.forEach((result) => {
        count += result.rowsAffected;
      });
      return { itemsDeleted: count };
    } catch (error) {
      console.error("Failed to deleteHabit. Reason: \n", error);
      return { error };
    }
  }

  /***
   * @param {string} oFile the NAME of the file (not including extension, applied via the 'format' parameter)
   * @about when exporting as a csv, two files will be generated Habits-[oFile].csv and HabitTallies-[oFile].csv whereas exporting to json will generate one file [oFile].json
   */
  async function exportHabitData(habitId, oFile, format = "csv") {
    const [habit, habitTallies] = await Promise.all([
      db.execute({
        sql: "SELECT * FROM Habits WHERE id = ?",
        args: [habitId],
      }),
      db.execute({
        sql: "SELECT * FROM HabitTallies WHERE habit_id = ?",
        args: [habitId],
      }),
    ]);

    if (format === "json") {
      const [jsonHabit] = convertResults(habit);
      const jsonTallies = convertResults(habitTallies);

      const json = JSON.stringify(
        {
          habit: jsonHabit,
          tallies: jsonTallies,
        },
        null,
        4,
      );
      await writeFile(`Habit-${oFile}.json`, json, "utf-8");
    } else {
      try {
        //csv
        let csvHabit = habit.columns.join(",") +"\n";
        csvHabit += habit.rows.map(row=>(
          Array.from(row).join(",")
        ) + "\n")
        
        let csvTallies = habitTallies.columns.join(",") + "\n";
        // for (const row of habitTallies.rows) {
        //   for(let c = 0; c < row.length; c++){
        //     csvTallies += `${row[c]}`
        //     if(c < row.length -1) csvTallies+= ","
        //   }
        //   csvTallies += "\n"
        csvTallies += habitTallies.rows.map(row=>(
          Array.from(row).join(",")
        ) + "\n")
        
        await Promise.all([
          writeFile(`Habit-${oFile}.csv`, csvHabit, "utf-8"),
          writeFile(`HabitTallies-${oFile}.csv`, csvTallies, "utf-8"),
        ]);

      } catch (error) {
        console.error("failed to export csv file(s)... \nReason: ", error);
      }
      
    }
  }

  return {
    getHabits,
    tallyHabit,
    addHabit,
    getTalliesOn,
    editHabit,
    deleteHabit,
    exportHabitData,
  };
};
