import {Scene} from "../../core/Scene";
import * as B from '@babylonjs/core';
import {Utils} from "../../utils/Utils";

export class CharacterCustomizationScene extends Scene {
    private _menuDiv!: HTMLDivElement;
    private _categoryBtn!: HTMLButtonElement;
    private _colorOptionsDiv!: HTMLDivElement;
    private _currentBtn!: B.Nullable<HTMLButtonElement>;

    private _models: B.Mesh[] = [];
    private _categories: string[] = ["Skin", "Hair", "Outfit"];
    private _categoryIndex: number = 0;
    private _skinUIColors: string[] = ["#9d6d59", "#895f4d", "#725042", "#895144", "#593f34", "#593e37", "#5f2a2a","#3f2e27", "#2f2420", "#24242b"];
    private _hairUIColors: string[] = ["#FFFFFF", "#731a1a", "#803413", "#8b7214", "#356218", "#175058", "#162056", "#44175a", "#551633", "#2f2f2f","#302021", "#1c1c1c"];
    private _outfitUIColors: string[] = ["#583e26","#502f20", "#351e2e", "#582331", "#76252e", "#992c30", "#731a1a", "#803413", "#953d27", "#8b7214", "#356218", "#18291d"];

    constructor() {
        super("Character Customization");
    }

    public async preload(): Promise<void> {
        this.game.engine.displayLoadingUI();

        // load assets
        this.loadedAssets["caveman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "caveman.glb", this.babylonScene);
        this.loadedAssets["cavewoman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "cavewoman.glb", this.babylonScene);
        this.loadedAssets["lobbyScene"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/scenes/", "lobbyScene.glb", this.babylonScene);

        this.game.engine.hideLoadingUI();
    }

    public start(): void {
        // camera
        this.mainCamera.position = new B.Vector3(1, 1.25, 4.5);
        this.mainCamera.rotation = new B.Vector3(0, Math.PI, 0);

        // light
        const light = new B.HemisphericLight("light1", new B.Vector3(0, 1, 0), this.babylonScene);
        light.intensity = 0.7;

        this._createCave();

        if (this.game.skinOptions.modelIndex === 0) {
            this._createPlayer(B.Vector3.Zero(), "caveman");
            this._createPlayer(new B.Vector3(8, 0, 0), "cavewoman");
        }
        else {
            this._createPlayer(new B.Vector3(8, 0, 0), "caveman");
            this._createPlayer(B.Vector3.Zero(), "cavewoman");
        }

        this._displayUI();
        Utils.applyColorsToMesh(this._models[this.game.skinOptions.modelIndex], this.game.skinOptions);
    }

    public destroy(): void {
        this.game.uiContainer.removeChild(this._menuDiv);
        super.destroy();
    }

    private _createCave(): void {
        const caveContainer = this.loadedAssets["lobbyScene"];
        caveContainer.addAllToScene();
        const cave = caveContainer.meshes[0];
        cave.scaling.scaleInPlace(.4);
        cave.position.x = 5;
    }

    private _displayUI(): void {
        this._menuDiv = document.createElement("div");
        this._menuDiv.innerHTML = `
            <div class="top-border">
               <p class="top-title left-title">Character Customization</p>
            </div>
            <img src="img/primal-olympics-logo.png" class="bottom-right-logo">
            <div class="bottom-border"></div>
        `;
        this.game.uiContainer.appendChild(this._menuDiv);

        // back button
        const backBtn: HTMLButtonElement = document.createElement("button");
        backBtn.className = "small-stone-button left-button";
        backBtn.onclick = (): void => {
            this.game.soundManager.playSound("click");
            this.game.fadeIn(this.sceneManager.changeScene.bind(this.sceneManager, "menu"));
        };
        backBtn.onmouseenter = (): void => this.game.soundManager.playSound("select");
        this._menuDiv.appendChild(backBtn);

        // back button image
        const backImg: HTMLImageElement = document.createElement("img");
        backImg.src = "img/back.png";
        backImg.id = "back-img";
        backBtn.appendChild(backImg);

        this._createNextButtons();

        // customization container
        const customizationContainer: HTMLDivElement = document.createElement("div");
        customizationContainer.id = "customization-container";
        this._menuDiv.appendChild(customizationContainer);

        // categories div
        const categoriesDiv: HTMLDivElement = document.createElement("div");
        categoriesDiv.id = "categories-div";
        customizationContainer.appendChild(categoriesDiv);

        // left arrow
        const leftArrowBtn: HTMLButtonElement = document.createElement("button");
        leftArrowBtn.className = "arrow-button left-arrow";
        leftArrowBtn.onclick = (): void => {
            this.game.soundManager.playSound("click");
            this._changeCategory(-1);
        };
        leftArrowBtn.onmouseenter = (): void => this.game.soundManager.playSound("select");
        categoriesDiv.appendChild(leftArrowBtn);

        // category button
        this._categoryBtn = document.createElement("button");
        this._categoryBtn.innerHTML = `${this._categories[0]}`;
        this._categoryBtn.id = "round-btn";
        this._categoryBtn.className = "large-stone-button";
        categoriesDiv.appendChild(this._categoryBtn);

        // right arrow
        const rightArrowBtn: HTMLButtonElement = document.createElement("button");
        rightArrowBtn.className = "arrow-button right-arrow";
        rightArrowBtn.onclick = (): void => {
            this.game.soundManager.playSound("click");
            this._changeCategory(1);
        };
        rightArrowBtn.onmouseenter = (): void => this.game.soundManager.playSound("select");
        categoriesDiv.appendChild(rightArrowBtn);

        // color options div
        this._colorOptionsDiv = document.createElement("div");
        this._colorOptionsDiv.id = "color-options-div";
        customizationContainer.appendChild(this._colorOptionsDiv);

        this._createColorOptions(this._categories[this._categoryIndex]);
    }

    private _createNextButtons(): void {
        // left next button
        const leftBtn: HTMLButtonElement = document.createElement("button");
        leftBtn.className = "next-button left-next-button";
        leftBtn.onclick = (): void => {
            this.game.soundManager.playSound("click");
            this._showNextModel();
            this._applyColors();
        };
        leftBtn.onmouseenter = (): void => this.game.soundManager.playSound("select");
        this._menuDiv.appendChild(leftBtn);

        // right next button
        const rightBtn: HTMLButtonElement = document.createElement("button");
        rightBtn.className = "next-button right-next-button";
        rightBtn.onclick = (): void => {
            this.game.soundManager.playSound("click");
            this._showNextModel();
            this._applyColors();
        };
        rightBtn.onmouseenter = (): void => this.game.soundManager.playSound("select");
        this._menuDiv.appendChild(rightBtn);
    }

    private _changeCategory(i: number): void {
        this._categoryIndex = (this._categoryIndex + i + this._categories.length) % this._categories.length;
        this._categoryBtn.innerHTML = `${this._categories[this._categoryIndex]}`;
        this._colorOptionsDiv.innerHTML = "";
        this._createColorOptions(this._categories[this._categoryIndex]);
        this._applyColors();
    }

    private _createColorOptions(category: string): void {
        if (category === "Skin") {
            this._skinUIColors.forEach((color: string, index: number): void => {
                const colorBtn: HTMLButtonElement = this._createColorBtn(color, index, this.game.skinOptions.skinColorIndex);
                colorBtn.onclick = (): void => {
                    this.game.soundManager.playSound("click");
                    this.game.skinOptions.skinColorIndex = index;
                    this._changeCurrentColorBtn(colorBtn);
                    this._applyColors();
                };
                colorBtn.onmouseenter = (): void => this.game.soundManager.playSound("select");
                this._colorOptionsDiv.appendChild(colorBtn);
            });
        }
        else if (category === "Hair") {
            this._hairUIColors.forEach((color: string, index: number): void => {
                const colorBtn: HTMLButtonElement = this._createColorBtn(color, index, this.game.skinOptions.hairColorIndex);
                colorBtn.onclick = (): void => {
                    this.game.soundManager.playSound("click");
                    this.game.skinOptions.hairColorIndex = index;
                    this._changeCurrentColorBtn(colorBtn);
                    this._applyColors();
                };
                colorBtn.onmouseenter = (): void => this.game.soundManager.playSound("select");
                this._colorOptionsDiv.appendChild(colorBtn);
            });
        }
        else if (category === "Outfit") {
            this._outfitUIColors.forEach((color: string, index: number): void => {
                const colorBtn: HTMLButtonElement = this._createColorBtn(color, index, this.game.skinOptions.outfitColorIndex);
                colorBtn.onclick = (): void => {
                    this.game.soundManager.playSound("click");
                    this.game.skinOptions.outfitColorIndex = index;
                    this._changeCurrentColorBtn(colorBtn);
                    this._applyColors();
                };
                colorBtn.onmouseenter = (): void => this.game.soundManager.playSound("select");
                this._colorOptionsDiv.appendChild(colorBtn);
            });
        }
    }

    private _createColorBtn(color: string, index: number, currentIndex: number): HTMLButtonElement {
        const colorBtn: HTMLButtonElement = document.createElement("button");
        if (index === currentIndex) {
            this._changeCurrentColorBtn(colorBtn);
        }
        else colorBtn.className = "color-button";
        colorBtn.style.backgroundColor = `${color}`;
        return colorBtn;
    }

    /**
     * De-selects the current color button and selects the new one
     * @param btn - The new color button to select
     */
    private _changeCurrentColorBtn(btn: HTMLButtonElement): void {
        // de-select the current button
        if (this._currentBtn) {
            this._currentBtn.className = "color-button";
        }

        // select the new button
        btn.className = "color-button color-button-selected";
        this._currentBtn = btn;
    }

    private _createPlayer(position: B.Vector3, type: string): void {
        let playerContainer: B.AssetContainer;
        if (type === "caveman") {
            playerContainer = this.loadedAssets["caveman"];
        } else {
            playerContainer = this.loadedAssets["cavewoman"];
        }

        const entries: B.InstantiatedEntries = playerContainer.instantiateModelsToScene((sourceName: string): string => sourceName, true, {doNotInstantiate: true});
        const player = entries.rootNodes[0] as B.Mesh;
        this._models.push(player);
        player.position = position;
        player.scaling.scaleInPlace(0.25);

        // animations
        const idleAnimation: B.AnimationGroup = Utils.getAnimationGroupByName(`Idle`, entries.animationGroups);
        idleAnimation.start(true, 1.0, idleAnimation.from, idleAnimation.to);
    }

    private _showNextModel(): void {
        // move the current model to the right
        const currentModel: B.Mesh = this._models[this.game.skinOptions.modelIndex];
        currentModel.position = new B.Vector3(8, 0, 0);

        // move to the next model in front of the camera
        this.game.skinOptions.modelIndex = (this.game.skinOptions.modelIndex + 1) % this._models.length;
        const nextModel: B.Mesh = this._models[this.game.skinOptions.modelIndex];
        nextModel.position = B.Vector3.Zero();
    }

    private _applyColors(): void {
        Utils.applyColorsToMesh(this._models[this.game.skinOptions.modelIndex], this.game.skinOptions);
        localStorage.setItem("skinOptions", JSON.stringify(this.game.skinOptions));
    }
}