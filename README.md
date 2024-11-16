# Primal Olympics
<p align="center">
  <img src="./img/primal-olympics-logo.png?raw=true" alt="logo">
</p>

*******
## Table of contents
1. [Gameplay trailer](#trailer-du-jeu)
2. [Link to game](#lien-du-jeu)
4. [Introducing the team](#présentation-de-léquipe)
5. [Game description](#description-du-jeu)
8. [Features](#fonctionnalités)
    - [Character customization](#personnalisation-des-personnages)
    - [Parameters](#paramètres)
    - [How to create a game](#comment-créer-une-partie)
    - [How to join a game](#comment-rejoindre-une-partie)
    - [Selection of mini-games](#choix-des-mini-jeux)
9. [Mini-games](#mini-jeux)
    - [Downhill Madness](#downhill-madness)
    - [Trex Track (100m)](#trex-track-100m)
    - [Stellar Storm](#stellar-storm)
    - [Savage Soccer (football)](#savage-soccer-football)
10. [Multiplayer development](#développement-du-multijoueur)
    - [Architecture](#architecture)
    - [Prediction and reconciliation](#prédiction-et-réconciliation)
    - [Interpolation](#interpolation)
11. [Creating assets](#réalisation-assets)
    - [Meshes](#meshes)
    - [Map creation](#réalisation-des-map)
    - [Animations](#animations)
    - [Sounds](#sons)
13. [Built with](#développé-avec)
14. [Software used](#logiciels-utilisés)

*******

<div id='trailer-du-jeu'></div>

## Gameplay trailer

[Gameplay trailer](https://youtu.be/yUZOyJOSVew)

<div id='lien-du-jeu'></div>

## Link to game
Play here : [Primal Olympics](https://doori4n.itch.io/primal-olympics)

<div id='présentation-de-léquipe'></div>

## Introducing the team
Our team is made up of Master 1 computer science students. **[Quentin Escobar](https://github.com/Moustik06)** took charge of 3D modeling, creating maps and objects, as well as characters and their outfits, hair and beards. **[Hugo Savasta](https://github.com/HugoSavasta)** focused on mini-games and **[Dorian Girard](https://github.com/Doori4N/)** structured the game, designed the user interface (UI) and also created mini-games.

<div id='description-du-jeu'></div>

## Game description
In our game, you'll compete against your opponents in a variety of events. At the end of each event, medals will be awarded according to your ranking (gold, silver and bronze medals for the first 3 positions, and no medals for the remaining players). When all events have been played, the player with the most medals will be declared the winner of the Primals Olympics. 


Our game is playable in single and multiplayer mode. However, if you want to enjoy the best experience, we strongly advise you to play multiplayer.

In Primal Olympics, you can play with a keyboard or a gamepad. Before the start of each mini-game, you'll be shown the keys to use for each control, along with a description of the event.

<div id='fonctionnalités'></div>

## Features 

<div id='personnalisation-des-personnages'></div>

### Character customization
You can choose your character's gender, skin color, clothing and hair color. The game offers a multitude of possible combinations to differentiate you from other players.

<p align="center">
  <img src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdHZybGI3am1qYWxxMzk3cGhlc2tzcHp5d2c3ejJyNXp5ODFseHVnNSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/61nnHZqzLU0YDMgKip/source.gif" alt="perso_custom" width="600">
</p>

<div id='paramètres'></div>

### Parameters
Players can choose whether or not to have their FPS displayed, and can also adjust the game's sound volume.

<p align="center">
  <img src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExNWMwb2QxejY1cTE2eXh6aDMxYWFmbWhhZGJzNjhxdTA5ZnY1eTNtMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/syRoIvlsFKczkd93lL/giphy.gif" alt="param" width="600">
</p>

<div id='comment-créer-une-partie'></div>

### How to create a game
- Just click on the `Host` button in the main menu.

<p align="center">
  <img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExNnJzMzM1N3dkemtyN3N4eXh1NHp6Z2x2Mmtmbng0ODk0MXBtNWc3eSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/FFzRSXlEonAOe5DppE/giphy.gif" alt="host" width="600">
</p>

<div id='comment-rejoindre-une-partie'></div>

### How to join a game
- Simply copy the code sent to you by the host!

<p align="center">
  <img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbTRqbjY5aXN4cndvajcwczRycmZwbXhlMmg3aHgxcmdtYWF1a25hNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/cK7oZ3vdPWOVQlI9Eo/source.gif" alt="join" width="600">
</p>  

<div id='choix-des-mini-jeux'></div>

### Selection of mini-games
- The host can select the mini-games and the number of mini-games to be played.

<p align="center">
  <img src="https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZDM3emxoaDFtcTI2MHJzNWhkZ2RzcHRmMmlvazY5cTBneHVvOHdpMCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/smCnfcS9HqBnnsxipE/giphy.gif" alt="choix_game" width="600">
</p>

<div id='mini-jeux'></div>

## Mini-games
Our game consists of 4 mini-games. Here is a brief description of each mini-game:

<div id='downhill-madness'></div>

### Downhill Madness
<p align="left">
  <img src="./img/slope-background.png?raw=true" alt="slope-background" width="100">
</p>
Players find themselves at the bottom of a mountain, and the first to reach the top is the winner. But be careful, the mountain is full of surprises, with huge logs and boulders tumbling down the path to the finish. You'll need to be as careful as possible to get over these obstacles and on your way to victory.

#### Rules
Medals are distributed according to the players' order of arrival. The game ends when all players have reached the top of the mountain, or when they have all fallen.

#### Controls
**PC:** `z`, `q`, `s`, `d` to move and `space` to jump.

**Xbox controller:** `Left joystick` to move, `A` button to jump.

**Playstation controller:** `Left joystick` to move, `X` button to jump.


#### Gameplay
[Downhill Madness](https://youtu.be/n9X7PCBeY4I)

<div id='trex-track-100m'></div>

### Trex Track (100m)
<p align="left">
  <img src="./img/track-and-field-background.png?raw=true" alt="track-and-field-background" width="100">
</p>
Under the deceptive guise of a simple 100-meter race, you'll have to be meticulous to escape the Trex, who won't hesitate to stop you in your quest for the gold medal...

#### Rules
Medals are distributed according to players' order of arrival. The game ends when all players have reached the finish line, or when the T-Rex has caught up.

#### Controls
**PC:** Alternate the `q` and `d` keys to run.

**Xbox controller:** Alternate `lb` and `rb` to run.

**Playstation controller:** Alternate `l1` and `r1` to run.

#### Gameplay
[Trex Track](https://youtu.be/fgDxKULAovg)

<div id='stellar-storm'></div>

### Stellar Storm
<p align="left">
  <img src="./img/meteorites-background.png?raw=true" alt="meteorite-background" width="100">
</p>
Players find themselves in the middle of a meteorite fall, but fortunately or not for them, they've all managed to take refuge on a huge boulder. But there can only be one survivor, and he'll have to try to survive the punches of his opponents to avoid falling into the lava...

#### Rules
The last survivor wins the gold medal. The silver and bronze medals will be awarded to the players who died last.

#### Controls
**PC:** `z`, `q`, `s`, `d` to move and `space` to punch.

**Xbox controller:** `left joystick` to move and `A` button to punch.

**Playstation controller:** `left joystick` to move, `X` button to punch.

#### Gameplay
[Stellar Storm](https://youtu.be/38aeldfoHnI)

<div id='savage-soccer-football'></div>

### Savage Soccer (football)
<p align="left">
  <img src="./img/football-background.png?raw=true" alt="football-background" width="100">
</p>
There's nothing like a good game of soccer to break the tie, with players tackling, passing and, of course, scoring goals. At the end of regulation time, the team with the most goals wins.

#### Rules
The winning team takes the gold medal and the losing team the bronze medal. In the event of a tie, both teams win the silver medal.

#### Controls
For PC Player: `z`, `q`, `s`, `d` to move, `shift` to pass and `space` to shoot or tackle without ball.

For Xbox Controller Player: `left joystick` to move, `A` button to shoot or tackle without ball and `B` button to pass.

For Playstation Controller Player: `left joystick` to move, `X` button to shoot or tackle without ball and `O` button to pass.


#### Gameplay
[Savage Soccer](https://youtu.be/fvJbbfjfkiU)

<div id='développement-du-multijoueur'></div>

## Multiplayer development
One of the key aspects of our game is multiplayer. Indeed, we've built all our mini-games around it, and that's why it's preferable to play with several players for a better experience.

To integrate it, we decided not to use a framework such as Colyseus, which greatly simplifies the development of such a game, because we wanted to understand how multiplayer works and how to integrate it into a project.

We chose to create a peer-to-peer game using the Peer.js library. Peer.js simplified communication and connection between peers.

Implementing multiplayer took much longer than expected, but we learned a multitude of concepts that will serve us well in the future.

<div id='architecture'></div>

### Architecture
Our architecture is as follows:
- One player is a host that acts as a server. This player has authority over all the other clients and is responsible for simulating the clients' inputs and then sending the results of these simulations to the other clients.
- The other clients send their inputs to the host and correct any simulation errors.

<div id='prédiction-et-réconciliation'></div>

### Prediction and reconciliation
During the preliminary testing phases of the game, we found that it was not playable for players with a poor connection (ping > 100ms), as movements were not fluid and responsive, making the experience quite frustrating.

We turned our attention to client-side prediction. This technique enables the user to instantly visualize the effect of his actions, by locally simulating the inputs sent to the host. Then, to ensure consistency between the game state perceived by the player and the actual state of the server, we implemented reconciliation. This process consists in correcting the client's erroneous predictions based on the results of simulations carried out on the server.

<div id='interpolation'></div>

### Interpolation
And finally, for objects whose prediction is not necessary, such as the AIs in “Savage Soccer” or the meteorites in “Stellar Storm”, interpolation had to be implemented to ensure visual fluidity between updates.

<div id='réalisation-assets'></div>

## Creating assets

<div id='meshes'></div>

### Meshes
We created all the assets by hand, with the exception of the character bodies and trees. There was no armature (skeleton to animate the character) or texture for the bodies, so we used [Mixamo](https://www.mixamo.com/#/) which generated them all by itself.

- **Men's model:** [Free3D](https://free3d.com/3d-model/male-base-mesh-6682.html)
- **Women's model:** [Sketchfab](https://sketchfab.com/3d-models/female-base-mesh-b6389ae82f044dbe9945c4dad2cd72ae)
- **Tree:** [Quaternius](https://quaternius.com/packs/ultimatestylizednature.html)

For 3D modeling, we used 2 software packages in particular: [Blender](https://www.blender.org/ ) and [Zbrush](https://www.maxon.net/fr/zbrush).

#### Female character modeling
<p align="center">
  <img src="./img/femme.png?raw=true" alt="Femme" width="600">
</p>

#### Male character modeling
<p align="center">
  <img src="./img/homme.png?raw=true" alt="Homme" width="600" heigth="50">
</p>

Blender was used to build the scenes from scratch, model the assets and add animations to our characters.

Zbrush was used for UV unwrapping and the creation of certain assets (female character hair and maps). UV unwrapping is a necessary and often difficult step, enabling us to flatten our 3D model in 2D and then add textures. This was made easier by the use of Zbrush.

<p align="center">
  <img src="./img/cheveux.png?raw=true" alt="Cheveux" width="600" heigth="100">
</p>


As for textures, we used [Substance 3D Painter](https://www.adobe.com/fr/products/substance3d-painter.html), which is very similar to PhotoShop but for 3D.

<div id='réalisation-des-map'></div>

### Map creation

#### Lobby
<p align="center">
  <img src="./img/lobby1.png?raw=true" alt="V1" width="600" heigth="100">
</p>

<p align="center">
  <img src="./img/lobby2.png?raw=true" alt="V2" width="600" heigth="100">
</p>

#### Downhill Madness
<p align="center">
  <img src="./img/downhill1.png?raw=true" alt="V1" width="600" heigth="100">
</p>

<p align="center">
  <img src="./img/downhill2.png?raw=true" alt="V2" width="600" heigth="100">
</p>

<p align="center">
  <img src="./img/downhill3.png?raw=true" alt="V3" width="600" heigth="100">
</p>

<p align="center">
  <img src="./img/downhill4.png?raw=true" alt="V4" width="600" heigth="100">
</p>

#### Trex Track
<p align="center">
  <img src="./img/100m1.png?raw=true" alt="V1" width="600" heigth="100">
</p>

<p align="center">
  <img src="./img/100m2.png?raw=true" alt="V2" width="600" heigth="100">
</p>

<p align="center">
  <img src="./img/100m3.png?raw=true" alt="V3" width="600" heigth="100">
</p>

<p align="center">
  <img src="./img/100m4.png?raw=true" alt="V4" width="600" heigth="100">
</p>

<p align="center">
  <img src="./img/100m5.png?raw=true" alt="V5" width="600" heigth="100">
</p>

#### Stellar Storm
<p align="center">
  <img src="./img/meteorite_1.png?raw=true" alt="V1" width="600" heigth="100">
</p>

<p align="center">
  <img src="./img/meteorite_2.png?raw=true" alt="V2" width="600" heigth="100">
</p>

#### Savage Soccer
<p align="center">
  <img src="./img/foot1.png?raw=true" alt="V1" width="600" heigth="100">
</p>

<p align="center">
  <img src="./img/foot2.png?raw=true" alt="V2" width="600" heigth="100">
</p>

<p align="center">
  <img src="./img/foot3.png?raw=true" alt="V3" width="600" heigth="100">
</p>

<div id='animations'></div>

### Animations
- Our character animations come from the website [Mixamo](https://www.mixamo.com/#/).

<div id='sons'></div>

### Sounds
- [Lobby Music](https://freesound.org/people/Mrthenoronha/sounds/370294/)
- [T-Rex Track Music](https://freesound.org/people/rodincoil/sounds/271383/)
- [T-Rex Steps](https://freesound.org/people/newlocknew/sounds/677414/)
- [T-Rex Roar](https://freesound.org/people/CGEffex/sounds/96223/)
- [Downhill Madness Music](https://youtu.be/8gGWSVHQ-EE)
- [Stellar Storm Music](https://www.youtube.com/watch?v=gbBjjC-KMgE)

<div id='développé-avec'></div>

## Built with
- [![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
- [![Babylon.js](https://img.shields.io/badge/Babylon.js-C64A44?style=for-the-badge)](https://www.babylonjs.com/)

<div id='logiciels-utilisés'></div>

## Software used
- [![Blender](https://img.shields.io/badge/Blender-FE8200?style=for-the-badge&logo=blender&logoColor=white)](https://www.blender.org)
- [![ZBrush](https://img.shields.io/badge/ZBrush-red?style=for-the-badge)]([https://www.blender.org](https://www.maxon.net/fr/zbrush))
- [![Adobe](https://img.shields.io/badge/Adobe-F44336?style=for-the-badge&logo=adobe&logoColor=white)](https://www.adobe.com/fr/)
