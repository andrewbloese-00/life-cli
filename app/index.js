//'services'
import { Habits } from "../habits/Habits.js";
import { Budgeting } from "../budgeting/Budgeting.js";

//utils
import { ColoredString } from "../utils/coloring.js";
import { panic } from "../utils/panic.js";

//3rd party lib 
import * as inquirer from '@inquirer/prompts'

//initializes the required services for the app
// -currently habits table only
async function getServices(){
    try {
        //load habits functions
        const habitService = await Habits()
        const budgetingService = await Budgeting()
        
        return { habitService, budgetingService}
    } catch (error) {
        panic(`Failed to get Services:${error}`, 1)
    }
}



function center(str,vw){
    const unoccupied = vw - str.length
    const left = Math.floor(unoccupied / 2);
    return " ".repeat(left) + str + " ".repeat(unoccupied-left)
}

// ============ START HABIT HANDLERS =================================

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

//for habit colors
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
    console.clear();
    console.log(ColoredString("== Create New Habit ==", "cyan","black",{bright:true}));

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


async function doHabitProgress(habitService){
    const allHabits = await habitService.getHabits()
    if( allHabits.error ) {
        return console.error("Failed to fetch habits data... \n Reason: ", ColoredString(allHabits.error, "red"))
    } 
    const now = new Date();
    const [ m , d, y] = [now.getMonth()+1,now.getDate(),now.getFullYear()]    
    const monthString = await inquirer.input({
        message: "Which month?\n > ",
        default: m,
    })

    const month = Number(monthString)
    const year =  await inquirer.input({message: "Which Year? \n > ", default: y, validate: s=>!isNaN(s)})
    const maxDays = new Date(year,month,0).getDate()
    const dateOfMonth = await inquirer.input({
        message: `Which Date?\n [1..${maxDays}]\n > `,
        default: d,
    })

    const days = Number(dateOfMonth)
    if(days < 1 || days > maxDays) { 
        return console.error("Failed to create date.\nReason: ", ColoredString(`Expected date in range [1..${maxDays}]`,"red"))
    }

    const selectedDate = new Date(Number(year),month-1,days)
    const { tallies , error } = await habitService.getTalliesOn(selectedDate)
    if(error || tallies[0] === null){
        return console.error("Failed to fetch talies for specified date. \nReason: ", ColoredString(error||"Unknown Error Occured","red"))
    }

    console.clear()
    const seen = {}
    console.log(ColoredString(`== Habits Progress | ${months[month-1]} ${days}, ${year} ==`, "green","black", {bright: true}))
    let display = ""
    for(const {id, color,daily_count, name, min_max, Progress } of tallies){
        const percent = Progress/daily_count
        const minOrMax = min_max === 0 ? "Minimum" : "Maximum"
        const paddedProgress = ColoredString((`${Progress}/${daily_count}`).padEnd(20, " "), color)
        const bar = progressBar(process.stdout.columns/2, percent, ColoredString('\u2588',color))
        display += (`\n${name} [${minOrMax}: ${daily_count}] \n ${paddedProgress}: ${bar}`)
        seen[id] = true
    }

    const unseenHabits = allHabits.habits.filter(({id}) => !seen[id])
    for( const { name, daily_count,color, min_max } of unseenHabits){
        const minOrMax = min_max === 0 ? "Minimum" : "Maximum"
        const paddedProgress = ColoredString((`0/${daily_count}`).padEnd(20, " "), color)
        const bar = progressBar(process.stdout.columns/2, 0, "")
        display += (`\n${name} [${minOrMax}: ${daily_count}] \n ${paddedProgress}: ${bar}\n`)
    }

    console.log(display)




    



}


async function doGetHabits(habitService,render=true){
    const { habits, error} = await habitService.getHabits()
    if(error) panic(`Failed to fetch habits! REASON: \n ${error}`,1)
    console.clear();

    if(render) console.log(ColoredString("== Habits ==\n","cyan","black",{bright: true}),habits.map(renderHabit).join("\n"))
    return habits
}

async function doAddTallies(habitService){
    console.clear();
    console.log(ColoredString("== Add Tallies ==", "cyan", "black", {bright: true}))
    const habits = await doGetHabits(habitService,false) //handles err for me
    //render the habits in the select 
    const habitSelected = await inquirer.select({
        message: "Select A Habit To Tally",
        choices: habits.map((habit,i)=>{
            const bg = habit.color === "black" ? "white" : "black"
            return {
                name: ColoredString(habit.name, habit.color,bg),
                value: i,
            }
        })
    })

    const howMany = await inquirer.input({
        message: "How many tallies would you like to add? (Enter a number > 0)\n >  ",
        validate: (s)=>!isNaN(s)
    })

    const habitIdSelected = habits[habitSelected].id

    const tallied = await habitService.tallyHabit(habitIdSelected,Number(howMany))
    if(tallied.error) panic(`Failed to tally habit... Reason: \n ${tallied.error}`,1);
    
    // const { tallies, error } = await habitService.getTalliesOn(new Date());
    // if(error) panic(`Failed to fetch updated tallies... Reason: \n${error}`)
    console.clear()
    console.log(ColoredString(`Successfully added ${howMany} to  ${habits[habitSelected].name}`, habits[habitSelected].color));

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
    console.clear()
    console.log(ColoredString("== Delete Habit ==", "cyan"))
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



/**
 * 
 * @param  habitService the Habits API 
 * @returns {Promise<void>} promise that resolves when user cancels or completes the edit action
 */
async function doHabitEdit(habitService){
    const habitOptions = await habitService.getHabits()
    if(habitOptions.error){
        panic(`Failed to fetch habits for updating: ${habitOptions.error}`)
    }
    console.clear()
    console.log(ColoredString(" == Updating Habit ==", "cyan"))
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






// ============ START BUDGETING HANDLERS =================================
async function doBudgetItemCreate(budgetService){

    console.clear()
    console.log(ColoredString("== Creating Budget Item == ", "cyan"));

    const name = await inquirer.input({
        message:"Enter a Name for the Budget Category\n > ",
    })

    const amount = await inquirer.input({
        message: "Enter the Monthly Amount for the Budget Category \n > ",
        validate: s =>!isNaN(s)
    })

    const when = await inquirer.input({
        message: "What day of the month is this item due? (0 for no due date)",
        validate: s => { 
            let n = Number(s); 
            return !isNaN(s) && n >= 0 && n <= 31
        }
    })


    const description = await inquirer.input({
        message: "Enter a description for this item: \n",
    })



    const { error, budget_item } = await budgetService.createBudgetItem(name, amount, when , description)
    if(error){
        console.error(
            "Failed to create budget item...\nReason: " + 
            ColoredString(error.message||error, "red","black",{bright: true})
        )
    } else { 
        console.log(
            ColoredString("Successfully created budget item!","green"),
            budget_item            
        )
    }
}

async function doBudgetEntryCreate(budgetService){
    const gotItems = await budgetService.getBudget()
    if(gotItems.error)
        panic(`Failed to fetch budget items...\nReason: ${ColoredString(gotItems.error,"red")}`)
    
    
    console.clear()
    console.log(ColoredString("== Create Budget Entry ==", "cyan"))
    const selectedIndex = await inquirer.select({
        message: "Which Item would you like to create an entry for?",
        choices: gotItems.budget_items.map((item,i)=>({
            name: item.name,
            value: i,
            description: item.description || item.due ? `Due monthly on day: ${item.due}` : "budget item",
        }))

    })
    const item =  gotItems.budget_items[selectedIndex]
    const now = new Date()
    const month = now.getMonth() + 1; 
    const year = now.getFullYear()
    const progress = await budgetService.getBudgetsWithProgress(month,year)
    if(progress.error){
        panic("Failed to fetch progres...")
    }
    const relatedProgress = progress.budgets_and_progress.find(prog=> prog !== null && prog.id === item.id)
    
    const remaining = relatedProgress 
        ?  item.amount - relatedProgress.progress
        :  item.amount
    

    const entryAmount = await inquirer.input({
        message: `Enter the amount to enter for ${item.name} [remaining: ${remaining}]\n > $`,
        validate: s=> !isNaN(s)
    })


    const entryMemo = await inquirer.input({
        message: `(Optional) Enter a memo for the budget entry:\n`,
    })
    const { budget_entry, error } = await budgetService.createBudgetEntry(item.id, Number(entryAmount), now.getTime(), entryMemo  )
    if(error){
        console.error(`Failed to create budget entry. \n\n Reason: ${ColoredString(error, "red")}`)
    }
    console.log(
        ColoredString(`Successfully added budget entry. New remaining amount for this month: $${remaining-Number(entryAmount)}`,"green")
    )
}



function progressBar(width,progress,fill){
    const w = width-2
    const bw = Math.min(w,Math.floor(progress*w))
    let bar = fill.repeat(bw)
    return "|" + bar + " ".repeat(w-bw)  + "|"
}
const months = [ "January", "February", "March", "April", "May", "June","July","August","September","October","November","December" ];
async function doGetBudgetingProgress(budgetService){

    const allBudgets = await budgetService.getBudget()
    if(allBudgets.error) {
        return console.error("Failed to fetch budget items...\n Reason: ", ColoredString(allBudgets.error,"red"))
    }



    const now = new Date()
    let month = now.getMonth() + 1;
    let year = now.getFullYear();

    year = await inquirer.input({
        message: "What year?\n > ",
        default: year
    })

    month = await inquirer.input({
        message: "Which month?\n > ",
        default: month
    })
    
    const { budgets_and_progress, error} = await budgetService.getBudgetsWithProgress(month,year)
    if(error){
        panic(`Failed to get budget history for ${month}/${year}... \nReason: ${ColoredString(error,"red")}`)
    }
    
    if(budgets_and_progress[0] === null) { 
        return console.error(`Failed to get budget progress for ${month}/${year}...\nReason: ${ColoredString("No Entries Found","red")}`)
    }
    console.clear();
    console.log(ColoredString(`== Budget Progress - ${ months[month-1]}, ${year} ==`,"cyan","black",{bright:true}))


    let display = ""
    const seen = {}
    const daysInMonth = new Date(year,month,0).getDate();
    
    for( const {id,name,due,amount,progress} of budgets_and_progress){
        const formattedDate = `${month}/${Math.min(daysInMonth,due)}/${year}`
        
        const percent = progress/amount
        const remaining = "$" + (amount - progress).toFixed(2);
        let output = `${ColoredString(name,"white", "black", {bright: true})} \n - ${due ? `Due: ${formattedDate}\n - `:""}Remaining: ${remaining}\n`
        output += progressBar(process.stdout.columns/2,Math.min(percent,1),ColoredString('\u2588',"green")) + "\n\n"
        display+= output
        seen[id] = true; 
    }
    
    //now append the 0 progress items
    const nonProgressItems = allBudgets.budget_items.filter(item => !seen[item.id])
    for(const { name , amount , due} of  nonProgressItems ){
        const formattedDate = `${month}/${Math.min(daysInMonth,due)}/${year}`
        let output = `${ColoredString(name,"white", "black", {bright: true})} \n - ${due ? `Due: ${formattedDate}\n - `:""}Remaining: ${amount}\n`
        output += progressBar(process.stdout.columns/2,0,"?") + "\n\n"
        display += output
    }

    console.log(display)
}




//Menus

/**
 * @about generates a block title to be used on application launch... 
 * @returns {string} the colored block text title (multiline)
 */
function generateTitle(){
    const title = [ 
        "##      ######  ######  ######         ####  ##      ###### ",
        "##        ##    ##      ##           ##      ##        ##   ",
        "##        ##    ####    ####    ###  ##      ##        ##   ",
        "##        ##    ##      ##           ##      ##        ##   ",
        "######  ######  ##      ######         ####  ######  ###### "

    ]
    let coloredTitle = "\n\n" 
    for(let i = 0; i < title.length; i++){
        for(let j = 0; j < title[i].length; j++){
            coloredTitle += (title[i][j] === "#") ? ColoredString('\u2588',"cyan","black",{bright: true}) : " " 
        }
        coloredTitle += "\n"
    }
    return coloredTitle;
}
let first = true; //flag for first render (only print the app title on first render)

/**
 * @about The main application loop, gets a command todo from the user, then runs the command function, or quits the program. 
 * @param habitService the Habits API
 * @returns {Promise<void>} 
 */
async function doRootMenu(habitService,budgetingService){
    if(first){
        console.clear();
        console.log(generateTitle())
        console.log([
            " => Create and Track Habits",
            " => Manage your budget",
            " ",
            " Quit at any time with (Ctrl+c) ",

        ].map(t=>ColoredString(t,"magenta")).join("\n"), "\n\n")
        first = false
    }

    const command = await inquirer.select({
        message: "Select A Module",
        choices: [
            {
                name: ColoredString("Habits","cyan","black",{bright:true}),
                value: "h",
                description: "Manage Your Daily Habits"
            },
            {
                name: ColoredString("Budgeting","green","black",{bright: true}),
                value: "b",
                description: "Manage Your Monthly Budget!"
            },
            new inquirer.Separator(),
            {
                name: ColoredString("Quit","red","black"),
                value: "q",
                description: "Exit the program."
            }  
        ]
    })


    switch(command){
        case "h": 
            await doHabitsMenu(habitService,true);
            break;
        case "b":
            await doBudgetingMenu(budgetingService,true);
            break;
        case "q": 
            console.log("Goodbye! :)\n")
            process.exit(0);    
        default: 
            panic("Unsupported Command: " + command)
    }

    await doRootMenu(habitService,budgetingService)

}


async function doBudgetingMenu(budgetingService,fromMain=false){
    if(fromMain)console.clear();
    console.log(ColoredString("== Budgeting ==", "green", "black", {bright: "true"}))
    const command = await inquirer.select({
        message: "Select An Action",
        loop: false,
        choices: [
            { 
                name: "Create A Budget Category",
                value: "cbi",
                description: "Create a budget category", 
            },
            {
                name: "Make Budget Entry",
                value: "cbe", 
                description: "Create an entry for a budget category"
            },
            {
                name: "View Budget History",
                value: "vb",
                description: "View your budget history."
            },
            new inquirer.Separator(),
            {
                name: ColoredString("Back", "yellow"),
                value: "b",
                description: "Go Back to Main Menu"
            },
            {
                name: ColoredString("Quit", "red"),
                value: "q",
                description: "Exit The Program"
            }
        ] 
    })

    switch(command){
        case "cbi": 
            await doBudgetItemCreate(budgetingService)
            break; 
        case "cbe": 
            await doBudgetEntryCreate(budgetingService)
            break;
        case "vb":
            await doGetBudgetingProgress(budgetingService) 
            break;
        case "b": 
            return; 
        case "q": 
            console.log("Goodbye! :)\n")
            process.exit(0)
    }
    await doBudgetingMenu(budgetingService)


}


async function doHabitsMenu(habitService,fromMain=false){
    if(fromMain) console.clear()
    console.log(
        ColoredString(`== Habits ==` , "cyan", "black", {bright: true})
    )
    const command = await inquirer.select({
        message: "Select An Action",
        loop: false,
        choices: [
            {
                name: "Create New Habit",
                value: "ch",
                description: "Create a new daily habit to track."
            },
            {
                name: "Update Habit",
                value: "uh",
                description: "Update an existing habit."
            },
            {
                name: "Mark Progress",
                value: "ph",
                description: "Track progress towards your Habits"
            },
            {
                name: "View Progress",
                value: "vh",
                description: "View daily progress for your habits.",
            },
            {
                name: "Delete Habit",
                value: "dh",
                description: "Delete an existing habit",
            },
            {
                name: "Export Data",
                value: "eh",
                description: "Export habits data to CSV or JSON file"
            },
            new inquirer.Separator(),
            {
                name: ColoredString("Back", "yellow"),
                value: "b",
                description: "Return to main menu"
            },
            {
                name: ColoredString("Quit","red"),
                value: "q",
                description: "Quit The Program"
            },

        ]
    })


    switch (command){
        case "ch":
            await doCreateHabit(habitService)
            break;
        case "uh":
            await doHabitEdit(habitService);
            break;
        case "ph": 
            await doAddTallies(habitService);
            break;
        case "dh":
            await doDeleteHabit(habitService);
            break;
        case "eh":
            await doExportHabits(habitService); 
            break;

        case "vh":
            await doHabitProgress(habitService)
            break;
        case "b":
            return; 
        case "q":
            console.log("Goodbye! :)")
            process.exit(0)
            
    }
    await doHabitsMenu(habitService)

}


async function main(){
    try {
        //intialize services
        const { habitService, budgetingService } = await getServices();
        //start application loop 
        await doRootMenu(habitService, budgetingService)
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