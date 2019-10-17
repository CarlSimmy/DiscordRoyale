import fs                     from 'fs'

import OutputBetLists         from './startFunctions/outputBetLists'
import GetPlayersForEvent     from './startFunctions/getPlayersForEvent'
import UpdateHealthForPlayers from './startFunctions/updateHealthForPlayers'
import ReplaceEventTargets    from './startFunctions/replaceEventTargets'
import GenerateTargetMessages from './startFunctions/generateTargetMessages'
import OutputRoundMessages    from './startFunctions/outputRoundMessages'
import CheckIfRoundFinished   from './startFunctions/checkIfRoundFinished'
import FollowUpEvent          from './startFunctions/followUpEvent'
//import EquipItems           from './startFunctions/equipItems'

const Start = ( Discord, bot, message, Events, Armors, gameStatus, playerList, deadPlayers, randomUniqueFrom, prevPlayerList, winsNeeded, startRematch, Stats, betStatus ) => {

  /* Check when game starts and when betting is available */
  gameStatus.started = true;
  betStatus.open = true;

  const startGameRound = async(nextEvent = false, nextPlayer = false) => {
    /* Variables */
    let event = nextEvent ? nextEvent : randomUniqueFrom(Events); // A random event for this round.
    let eventTargetIdxs = []; // Indices of effected targets in playerList.
    let playersDied = 0; // To check if a player died this round to type it out.
    let obtainedItem = {}; // To save item for print-out after obtained.
    let roundWinner = { wins: -1 }; // Winner of the current game round.

    /* Functions for settings variables from child components */
    const setEffectedTargets = effected => event.effectedTargets = effected; // If event targets ALL, update effected targets in events.json since there are no effected targets by default.
    const increasePlayersDied = () => playersDied++; // To check how many players died this round, used when outputting R.I.P messages.
    const changeGameStatus = winningPlayer => {
      roundWinner = winningPlayer;
      gameStatus.started = false;

      /* Save player win to stats file */
      if ( winningPlayer.id > 100 ) {
        if ( !Stats[winningPlayer.id] ) { Stats[winningPlayer.id] = { wins: 0 }; } // If player is not in file, add them first.
        Stats[winningPlayer.id].wins += 1;
      } else { // Adding all bot players as id "0". >100 check is probably good enough for now since people won't add more than 100 bots?
        if ( !Stats[0] ) { Stats[0] = { wins: 0 }; }
        Stats[0].wins += 1;
      }

      fs.writeFile(__dirname + '/../lists/stats.json', JSON.stringify(Stats), err => {
        err && console.log(err);
      });

      return clearPlayerLists();
    }
    const clearPlayerLists = () => (playerList.length = 0, deadPlayers.length = 0);
    const breakArmor = targetPlayer => targetPlayer.equipment.armor = { name: '', value: 0 };
    const updatePlayerList = winningPlayer => winningPlayer.wins += 1;
    const updatePrevPlayerList = winningPlayerId => prevPlayerList.find(player => player.id === winningPlayerId).wins += 1; // Add win to prevPlayerList before rematch.
    const initiateRematch = () => startRematch(message, winsNeeded); // Rematch function added here since roundFinished.js can't directly call index.js.

    /* If there are more targets than active players for the event, ignore and restart the game loop to pick a new */
    if ( (event.targets > playerList.length) && event.targets !== 'all' ) return startGameRound();

    /* Getting random players for the current event */
    await GetPlayersForEvent(event, randomUniqueFrom, playerList, setEffectedTargets, eventTargetIdxs, nextPlayer);

    /* När man blir trollad till en zebra ser man ut som en zebra */
    if ( event.description.includes("till en zebra") ) {
      playerList[eventTargetIdxs[0]].url = 'https://tiergarten.nuernberg.de/fileadmin/bilder/Tierinformationen/Bilder/Wueste/Grevyzebra.jpg';
      playerList[eventTargetIdxs[0]].title = 'Ett med naturen';
    }
  
    /* Equipping item, should be in own function when bigger */
    if ( event.itemType ) {
      event.armor ? obtainedItem = event.armor : obtainedItem = await randomUniqueFrom(Armors); // Check if there is a specified armor or not for the event.
      playerList[eventTargetIdxs[0]].equipment.armor.name = obtainedItem.name;
      playerList[eventTargetIdxs[0]].equipment.armor.value = obtainedItem.value;
    }

    /* Creating the event by replacing targets with the correct targeted players names */
    let roundMessage = await ReplaceEventTargets(event, playerList, eventTargetIdxs, obtainedItem);

    /* If there is a follow-up to the event, wait for it to play out before continuing */
    if ( event.followUpEvents ) {
      let newData = await FollowUpEvent(bot, Discord, message, randomUniqueFrom, event, roundMessage, playerList, eventTargetIdxs, startGameRound);
      return startGameRound(newData.event, newData.player);
    }

    /* Update health for effected targets and remove dead players */
    if ( !event.itemType ) {
      await UpdateHealthForPlayers(event, playerList, increasePlayersDied, breakArmor, eventTargetIdxs);
    }    

    /* Generate messages for HP loss/gain and show life bars */
    let effectedTargetsMessages = [];
    await GenerateTargetMessages(bot, event, playerList, eventTargetIdxs, effectedTargetsMessages);
 
    /* Moving dead players before outputting round messages */
    playerList.forEach((player, idx) => {
      if ( player.health <= 0 ) {
        deadPlayers.push(...playerList.splice(idx, 1));
      }
    })

    /* Output the messages for events and players dying/winning */
    await OutputRoundMessages(roundMessage, effectedTargetsMessages, message, Discord, playersDied, deadPlayers, playerList, changeGameStatus, updatePlayerList, updatePrevPlayerList);

    /* At the end of every loop; If a round is finished, output winner, winning bets and check if there are still more rounds to play. If round is not finished, restart the game loop again */
    await CheckIfRoundFinished(message, gameStatus, roundWinner, Stats, prevPlayerList, fs, winsNeeded, initiateRematch, startGameRound);
  }

  OutputBetLists(message, playerList, betStatus, Discord, Stats); // Outputs players to bet on and placed bets before a round starts.
  setTimeout(startGameRound, 30000); // Initial start of the game round, 5 seconds after outputting bet list.
}

export default Start