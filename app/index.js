import { Habits } from "../habits/Habits.js";
import { ColoredString } from "../utils/coloring.js";
import { panic } from "../utils/panic.js";

import * as inquirer from '@inquirer/prompts'

//initializes the required services for the app
// -currently habits table only
async function getServices(){
    try {
        //load habits functions
        const habitService = await Habits()
        return { habitService}
    } catch (error) {
        panic(`Failed to get Services:${error}`, 1)
    }
}

/**
 * @param {{ name: string, id: number, daily_count: number, color: string, Progress: number}[]} 
 * @about Renders the list view of habits, including progress bars. 
 * @returns {string} the rendered view (with colors and progress bars) ready to be printed to stdout
 */
function renderTallies(tallies){
    let lines  = [ ]
    for(const tally of tallies) {
        const txt = `[${tally.id}] ${tally.name} -> ` 
        const remaining = (process.stdout.columns - txt.length - 10)
        const barWidth = Math.floor(remaining * (tally.Progress / tally.daily_count));
        const bar = `[${"=".repeat(barWidth).padEnd(remaining," ")}]`
        lines.push(`${txt}${bar}`)
    } 
    return lines.join('\n')
}

function center(str,vw){
    const unoccupied = vw - str.length
    const left = Math.floor(unoccupied / 2);
    return " ".repeat(left) + str + " ".repeat(unoccupied-left)
  }


/**
 * @about renders a habit component ( a color coded string with id, name and daily count displayed, as well as if min or max goal) 
 * @param {{id: number, name: string, daily_count: number min_max: number, color: string}}} habit 
 */
function renderHabit(habit){
    let fg = habit.color === "white" ? "black" : "white"
    const h = ColoredString(
        `[${habit.id}] ${habit.name} | ${habit.daily_count} | ${habit.min_max === 0 ? "MIN" : "MAX"}`.padEnd(process.stdout.columns," "),
         fg, 
         habit.color
    )
    return h
}
const colorPicker = [
    `(1) ${ColoredString(" ","white","black")} `,
    `(2) ${ColoredString(" ","white","red")} `,
    `(3) ${ColoredString(" ","white","green")} `,
    `(4) ${ColoredString(" ","white","yellow")} `,
    `(5) ${ColoredString(" ","white","blue")} `,
    `(6) ${ColoredString(" ","white","magenta")} `,
    `(7) ${ColoredString(" ","white","cyan")} `,
    `(8) ${ColoredString(" ","black","white")} `,
]
const colorPickerValues = [
    "black", "red","green","yellow","blue","magenta","cyan","white"
] 

async function doCreateHabit(habitService){
    //get the name
    const name = await inquirer.input({message: "What's the name of the Habit?\n >  "})
    
    //how many times per day? 
    const dailyGoal = await inquirer.input({
        message: "What is The Daily Goal?",
        validate: (str)=> !isNaN(str),
    })
    //get if min or max goal 
    const minOrMax = Number(await inquirer.select({
        message: "Is this a minimum goal or maximum goal?",
        choices: [
            {
                name: "Minimum",
                value: "0",
                description: "You want to complete the habit at LEAST x times per day."
            },
            {
                name: "Maximum",
                value: "1",
                description: "You want to complete the habit at MOST x times per day "
            }, 

        ]
    }))


    //select a color
    const color = await inquirer.select({
        message: "Select a color for the habit!",
        choices: colorPicker.map((text,i)=>({
            name: text,
            value: colorPickerValues[i],
            
        }))
    })

    //attempt to create a habit, panic (exit) on fail
    const { habit , error } = await habitService.addHabit(name,dailyGoal,minOrMax,color)
    if(error) panic(`Failed to create new habit! REASON:\n ${error}`)
    else { 
        console.log(`Successfully created a Habit!`)
        console.log(renderHabit(habit))
    }

}


async function doGetHabits(habitService,render=true){
    const { habits, error} = await habitService.getHabits()
    if(error) panic(`Failed to fetch habits! REASON: \n ${error}`,1)
    if(render) console.log(habits.map(renderHabit).join("\n"))
    return habits
}

async function doAddTallies(habitService){
    console.log(ColoredString("== Add Tallies ==", "cyan", "black", {bright: true}))
    const habits = await doGetHabits(habitService,false)
    //render the habits in the select 
    const habitIdSelected = await inquirer.select({
        message: "Select A Habit To Tally",
        choices: habits.map(habit=>{
            const bg = habit.color === "black" ? "white" : "black"
            return {
                name: ColoredString(habit.name, habit.color,bg),
                value: habit.id,
            }
        })
    })

    const howMany = await inquirer.input({
        message: "How many tallies would you like to add? (Enter a number > 0)\n >  ",
        validate: (s)=>!isNaN(s)
    })


    const tallied = await habitService.tallyHabit(habitIdSelected,Number(howMany))
    if(tallied.error) panic(`Failed to tally habit... Reason: \n ${tallied.error}`,1);

    const { tallies, error } = await habitService.getTalliesOn(new Date());
    if(error) panic(`Failed to fetch updated tallies... Reason: \n${error}`)
    console.log(renderTallies(tallies))











    




}










async function main(){
    const { habitService } = await getServices();
    // await doCreateHabit(habitService)
    // await doGetHabits(habitService)
    await doAddTallies(habitService)


    





    

    








}

main()