const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',     // bold
    italic: '\x1b[3m',  // non-standard feature
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',
  
    fg: {
      black: '\x1b[30m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      crimson: '\x1b[38m',
    },
  
    bg: {
      black: '\x1b[40m',
      red: '\x1b[41m',
      green: '\x1b[42m',
      yellow: '\x1b[43m',
      blue: '\x1b[44m',
      magenta: '\x1b[45m',
      cyan: '\x1b[46m',
      white: '\x1b[47m',
      crimson: '\x1b[48m',
    },
}

/**
 * @typedef { 'black'|'red'|'green'|'yellow'|'blue'|'magenta'|'cyan'|'white'|'crimson' } ANSIColor
 * @typedef {{bright?:boolean, dim?: boolean, italic?: boolean, underscore?:boolean, blink?: boolean, reverse?: boolean, hidden?: boolean}} TextEffectConfig
 */

/**
 * @param {string} text
 * @param {ANSIColor} foreground 
 * @param {ANSIColor|undefined} background 
 * @param {TextEffectConfig} effects
 */
export function ColoredString(text,foreground,background,effects={}){
    let flags = colors.fg[foreground]
    if(background) flags += colors.bg[background]
    for(let effect in effects){ 
        if(effects[effect]) flags += colors[effect]
    }
    return `${flags}${text}${colors.reset}`;
}



