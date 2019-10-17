import * as fetch from 'node-fetch'

const AddBot = ( message, playerList, Titles, randomUniqueFrom, addPlayer ) => {
  let id = 1;
  let name = '';
  let title = randomUniqueFrom(Titles);
  let avatar = '';

  while ( playerList.map(player => ( player.id )).includes(id) ) {
    id = id + 1;
  }

  fetch('https://randomuser.me/api/')
    .then(response => response.json())
    .then(user => {
      name = user.results[0].name.first.charAt(0).toUpperCase() + user.results[0].name.first.slice(1); // First name with capitalized letter.
      avatar = user.results[0].picture.medium;
      return;
    })
    .then(() => {
      addPlayer(id, name, title, avatar);
      return message.channel.send(`Bot ${name} has entered the game!`).then(msg => msg.delete(7000));
    })
    .catch(error => {
      console.log(`Unable to fetch user ${error}`);
    })
}

export default AddBot