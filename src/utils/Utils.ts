import {MinPriorityQueue} from "priority-queue-typed";
import {AstarNode} from "./types";
import * as B from "@babylonjs/core";
import {SkinOptions} from "../core/types";

const _skinColors: string[] = ["#FFFFFF", "#DEDEDE", "#B9B9B9", "#8F8E8E", "#626262", "#454545"];
const _hairColors: string[] = ["#FFFFFF", "#B62323", "#C24E14", "#D5AD14", "#51991D", "#197481", "#192C81", "#611981", "#81194A", "#482E2E", "#474747", "#252525"];
const _outfitColors: string[] = ["#A23F3F", "#FFFFFF", "#C4FF00", "#4EDC3C"];

export class Utils {
    /**
     * Linear interpolation between two numbers
     * @param a first number
     * @param b second number
     * @param n interpolation value between 0 and 1
     */
    public static lerp(a: number, b: number, n: number): number {
        return a + (b - a) * n;
    }

    /**
     * Shuffles array in place.
     */
    public static shuffle<T>(array: T[]): void {
        for (let i: number = array.length - 1; i > 0; i--) {
            const j: number = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /**
     * Returns a random integer between min (inclusive) and max (inclusive)
     */
    public static randomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Returns a random float between min (inclusive) and max (exclusive)
     */
    public static randomFloat(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    /**
     * Finds the shortest path between two points using the A* algorithm
     * Returns the path as an array of coordinates or null if no path is found
     * @param grid 2D array representing the grid (0 = empty, 1 = obstacle)
     * @param start starting point
     * @param end ending point
     */
    public static astar(grid: number[][], start: number[], end: number[]): number[][] | null {
        const openSet = new MinPriorityQueue<AstarNode>([], {comparator: (a: AstarNode, b: AstarNode) => a.f - b.f});

        openSet.add({
            x: start[0],
            y: start[1],
            f: Utils.manhattanDistance(start, end),
            parent: null
        });

        const gScore: number[][] = [];

        // initialize gScore and fScore
        for (let i: number = 0; i < grid.length; i++) {
            gScore[i] = [];
            for (let j: number = 0; j < grid[i].length; j++) {
                gScore[i][j] = Infinity;
            }
        }

        gScore[start[0]][start[1]] = 0;

        while (!openSet.isEmpty()) {
            const currentNode = openSet.poll() as AstarNode;

            // if the current node is the end node, return the path
            if (currentNode.x === end[0] && currentNode.y === end[1]) {
                const path: number[][] = [];
                let temp: AstarNode | null = currentNode;
                while (temp) {
                    path.push([temp.x, temp.y]);
                    temp = temp.parent;
                }
                return path.reverse();
            }

            const neighbours: number[][] = [
                [0, 1],
                [0, -1],
                [1, 0],
                [-1, 0],
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1]
            ];

            // loop through the neighbours
            for (const neighbour of neighbours) {
                const neighbourX: number = currentNode.x + neighbour[0];
                const neighbourY: number = currentNode.y + neighbour[1];

                // if the neighbour is out of bounds, skip it
                if (neighbourX < 0 || neighbourY < 0 || neighbourX >= grid.length || neighbourY >= grid[0].length) {
                    continue;
                }

                // if the neighbour is an obstacle, skip it
                if (grid[neighbourX][neighbourY] === 1) {
                    continue;
                }

                const tentativeGScore: number = gScore[currentNode.x][currentNode.y] + 1;
                // if the path to the neighbour is shorter than the current path, update the neighbour
                if (tentativeGScore < gScore[neighbourX][neighbourY]) {
                    const neighbourNode: AstarNode = {
                        x: neighbourX,
                        y: neighbourY,
                        f: tentativeGScore + Utils.manhattanDistance([neighbourX, neighbourY], end),
                        parent: currentNode
                    };
                    gScore[neighbourX][neighbourY] = tentativeGScore;

                    openSet.add(neighbourNode);
                }
            }
        }

        return null;
    }

    /**
     * Returns the Manhattan distance between two points
     * @param a first point [x, y]
     * @param b second point [x, y]
     */
    public static manhattanDistance(a: number[], b: number[]): number {
        return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    }

    /**
     * Get the animation group by name
     * @param name The name of the animation group
     * @param animationGroups The list of animation groups to search
     */
    public static getAnimationGroupByName(name: string, animationGroups: B.AnimationGroup[]): B.AnimationGroup {
        return animationGroups.find((animationGroup: B.AnimationGroup): boolean => animationGroup.name === name)!;
    }

    /**
     * Apply the selected colors to the player mesh
     * @param playerMesh The player mesh to apply the colors to
     * @param skinOptions The selected skin options
     */
    public static applyColorsToMesh(playerMesh: B.Mesh, skinOptions: SkinOptions): void {
        if (skinOptions.modelIndex === 0) {
            // skin color
            const skinMaterial = playerMesh.getChildMeshes()[2].material as B.PBRMaterial;
            skinMaterial.albedoColor = B.Color3.FromHexString(_skinColors[skinOptions.skinColorIndex]).toLinearSpace();

            // hair color
            const hairMaterial = playerMesh.getChildMeshes()[3].material as B.PBRMaterial;
            if (hairMaterial.albedoTexture) hairMaterial.albedoTexture = null;
            hairMaterial.albedoColor = B.Color3.FromHexString(_hairColors[skinOptions.hairColorIndex]).toLinearSpace();

            // outfit color
            const outfitMaterial = playerMesh.getChildMeshes()[1].material as B.PBRMaterial;
            outfitMaterial.albedoColor = B.Color3.FromHexString(_outfitColors[skinOptions.outfitColorIndex]).toLinearSpace();
        }
        else {
            // skin color
            const skinMaterial1 = playerMesh.getChildMeshes()[0].material as B.PBRMaterial;
            const skinMaterial2 = playerMesh.getChildMeshes()[1].material as B.PBRMaterial;
            skinMaterial1.albedoColor = B.Color3.FromHexString(_skinColors[skinOptions.skinColorIndex]).toLinearSpace();
            skinMaterial2.albedoColor = B.Color3.FromHexString(_skinColors[skinOptions.skinColorIndex]).toLinearSpace();

            // hair color
            const hairMaterial = playerMesh.getChildMeshes()[4].material as B.PBRMaterial;
            if (hairMaterial.albedoTexture) hairMaterial.albedoTexture = null;
            hairMaterial.albedoColor = B.Color3.FromHexString(_hairColors[skinOptions.hairColorIndex]).toLinearSpace();

            // outfit color
            const outfitMaterial = playerMesh.getChildMeshes()[2].material as B.PBRMaterial;
            outfitMaterial.albedoColor = B.Color3.FromHexString(_outfitColors[skinOptions.outfitColorIndex]).toLinearSpace();
        }
    }
}