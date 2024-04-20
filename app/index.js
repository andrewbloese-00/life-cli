import { Habits } from "../habits/Habits.js";
import { ColoredString } from "../utils/coloring.js";
import { panic } from "../utils/panic.js";
import { existsSync } from 'fs'
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
        const p = Math.min(tally.Progress,tally.daily_count)
        const txt = `[${tally.id}] ${tally.name} -> ` 
        const remaining = (process.stdout.columns - txt.length - 10)
        const barWidth = Math.floor(remaining * (p / tally.daily_count));
        const bar = ColoredString(`[${"=".repeat(barWidth).padEnd(remaining," ")}]`, tally.color, tally.color === "black" ? "white" : "black")
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
    const habits = await doGetHabits(habitService,false) //handles err for me
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

async function doExportHabits(habitService){
    const { habits , error } = await habitService.getHabits()
    if(error) panic(`Failed to fetch habits to be exported... Reason: \n${error}`);
    
    const format = await inquirer.select({
        message: "Which format?",
        choices: [
            {
                name: "JSON",
                value: "json",
                description: "A single JSON file (per habit) containing habit properties and tally history."
            },
            {
                name: "CSV",
                value: "csv",
                description: "A CSV table of the habit itself, and a table of all related tally history."
            }
        ]
    })


    const selectedHabits = await inquirer.checkbox({
        message: "Select the habit(s) you would like to export (Space to toggle, enter to continue)",
        choices: habits.map(habit=>({
            name: habit.name,
            value: habit.id
        }))
    })

    const q = [] 
    for(const habitId of selectedHabits) {
        q.push(habitService.exportHabitData(habitId,habitId,format))

    }
    await Promise.allSettled(q);
    console.log(
        ColoredString("Export Completed!", "green")
    )

    

}


async function doDeleteHabit(habitService){
    const { habits, error } = await habitService.getHabits()
    if(error) panic(`Failed to fetch habits list for deletion... Reason: \n ${error}`)
    const selected = await inquirer.select({
        message: "Select A Habit to Delete", 
        choices: habits.map((habit,i)=>{
            return { 
                name: ColoredString(habit.name, habit.color, habit.color === "black" ? "white" : "black" ),
                value: i
            }
        })
    })

    const habitString = ColoredString(habits[selected].name, habits[selected].color, habits[selected].color === "black" ? "white" : "black")
    const confirmDelete = await inquirer.confirm({message: `Are you sure you want to delete the habit: ${habitString}?\n > `})
    if(confirmDelete){
        const deleted = await habitService.deleteHabit(habits[selected].id)
        if(deleted.error) panic(`Failed to delete habit... \nReason: ${deleted.error}`)
        console.log(ColoredString(`Successfully Deleted Habit!`, "green"))
    } else { 
        console.log(
            ColoredString( `Cancelled Delete Habit Action, returning to menu...`, "red")
        )

        
    }
}



async function doHabitEdit(habitService){
    const habitOptions = await habitService.getHabits()
    if(habitOptions.error){
        panic(`Failed to fetch habits for updating: ${habitOptions.error}`)
    }
    const selectedIndex = await inquirer.select({
        message: "Select a habit to update...",
        choices: habitOptions.habits.map((habit,i)=>({
            name: ColoredString(habit.name,habit.color,habit.color === "black" ? "white" : "black"),
            value: i,
        }))
    })
    const habit = habitOptions.habits[selectedIndex]
    const new_name = await inquirer.input(({
        message: "Habit Name: ",
        default: habit.name,
    }))

    const new_count = await inquirer.input({
        message: "Daily Goal: ", 
        default: habit.daily_count,
        validate: s => !isNaN(s)
    })

    const min_or_max = await inquirer.select({
        message: "Minimum or Maximum Goal: ",
        choices: [
            {
                name: "Minimum",
                value: 0,
                description: "Habit should be completed at LEAST <daily goal> times."
            },
            {
                name: "Maximum",
                value: 1,
                description: "Habit should be completed at MOST <daily goal> times."
            }
        ],
        default: habit.min_max
    })


    const new_color = await inquirer.select({
        message: "Color: ",
        choices: colorPicker.map((color,i)=>({
            name: color,
            value: colorPickerValues[i], 
        })),
        default: habit.color
    })


    const update = await habitService.editHabit(habit.id, {
        name: new_name, 
        daily_count: new_count,
        min_max: min_or_max,
        color: new_color
    })

    if(update.error){
        return console.error(
            ColoredString(`Failed to update Habit... \n Reason: ${update.error}`)
        )
    } else { 
        return console.log(ColoredString("Successfully updated Habit!", "green"))
    }





}





function generateTitle(){
    // const title = [ 
    //     "##  ##    ###    ####    ######  ######   #### ",
    //     "##  ##  ##   ##  ##  ##    ##      ##    ##    ",
    //     "######  #######  ####      ##      ##     ###  ",
    //     "##  ##  ##   ##  ##  ##    ##      ##        ##",
    //     "##  ##  ##   ##  ####$   ######    ##    ####  ",
    // ]

    const title = [ 
        "##      ######  ######  ######         ####  ##      ###### ",
        "##        ##    ##      ##           ##      ##        ##   ",
        "##        ##    ####    ####    ###  ##      ##        ##   ",
        "##        ##    ##      ##           ##      ##        ##   ",
        "######  ######  ##      ######         ####  ######  ###### "

    ]



    let coloredTitle = "" 
    for(let i = 0; i < title.length; i++){
        for(let j = 0; j < title[i].length; j++){
            coloredTitle += (title[i][j] === "#") ? ColoredString('\u2588',"cyan","black",{bright: true}) : " " 
            // coloredTitle += ColoredString(title[i][j], colors[c],"black",{bright:true});
        }
        
        
        
        coloredTitle += "\n"
    }
    return coloredTitle;
}














let first = true; 
async function doRootMenu(habitService){
    if(first){
        console.log(generateTitle())
        first = false
    }

    const option = await inquirer.select({
        message: "Select an action",
        choices: [ 
            new inquirer.Separator( ColoredString("---Habits---", "cyan","black",{ bright: true})),
            {
                name: "Add New Habit",
                value: "a",
                description: "Create a new daily habit to track"
            },
            {
                name: "Add Tally",
                value: "t",
                description: "Mark progress towards an existing habit"
            },
            {
                name: "Delete Habit",
                value: "d", 
                description: "Delete an existing habit"
            },
            {
                name: "Update Habit",
                value: "u",
                description: "Update an existing habit"
            },
            {
                name: "Export Habit Data",
                value: "e",
                description: "Export your habits to csv or json format"
            },
            new inquirer.Separator(""),
            {
                name: "Quit",
                value: "q",
                description: "Quit the program..."
            }
        ]
    })

    switch(option){
        case "a": 
            await doCreateHabit(habitService)
            break;
        case "t":
            await doAddTallies(habitService)
            break;
        case "e":
            await doExportHabits(habitService)
            break; 
        case "d": 
            await doDeleteHabit(habitService)
            break;
        case "u": 
            await doHabitEdit(habitService)
            break;
        case "q": 
            console.log("Goodbye :)")
            process.exit(0)
        default: 
            panic("Unrecognized option: " + option);
    }
    console.log(ColoredString("== Habits ==", "cyan","black",{bright: true}))

    await doRootMenu(habitService)
}







async function main(){
    try {
        const { habitService } = await getServices();
        await doRootMenu(habitService)
    } catch (error) {
        if(error.message.startsWith("User force closed")){
            console.log("Goodbye :)")
            process.exit(0)
        }
        console.error(error.message)
        panic("APPLICATION ERROR",1)
    }
}

main()