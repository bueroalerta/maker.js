﻿/// <reference path="roundrectangle.ts" />

module makerjs.models {

    export class Oval extends RoundRectangle {

        constructor(public width: number, public height: number) {
            super(width, height, Math.min(height / 2, width / 2));
        }

    }

} 