/**
 * Extend the basic ActorSheet
 * @extends {ActorSheet}
 */

import {DCC} from './config.js';
import {parseNPC} from './npc-parser.js';

export class DCCActorSheet extends ActorSheet {

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["dcc", "sheet", "actor"],
            template: "systems/mcc/templates/actor-sheet-zero-level.html",
            width: 600,
            height: 600,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
            dragDrop: [{dragSelector: ".weapon-list .weapon", dropSelector: null}]
        });
    }

    /** @inheritdoc */
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();

        buttons.unshift(
            {
                label: "Import Stats",
                class: "paste-block",
                icon: "fas fa-paste",
                onclick: ev => this._onPasteStatBlock(ev)
            },
            {
                label: "Clear",
                class: "clear-sheet",
                icon: "fas fa-eraser",
                onclick: ev => this._onClearSheet(ev)
            }
        );

        return buttons
    }

    /* -------------------------------------------- */

    /** @override */
    getData() {
        // Basic data
        let isOwner = this.entity.owner;
        const data = {
            owner: isOwner,
            limited: this.entity.limited,
            options: this.options,
            editable: this.isEditable,
            cssClass: isOwner ? "editable" : "locked",
            isCharacter: this.entity.data.type === "character",
            isNPC: this.entity.data.type === "NPC",
            isZero: this.entity.data.type === "Zero-Level",
            config: CONFIG.DCC,
        };

        data.actor = duplicate(this.actor.data);
        data.data = data.actor.data;
        data.labels = this.actor.labels || {};
        data.filters = this._filters;

        data.data.utility = {};
        data.data.utility.meleeWeapons = [0, 1, 2];
        data.data.utility.rangedWeapons = [3, 4];
        //console.log(data.data);

        if (data.isNPC) {
            this.options.template = "systems/mcc/templates/actor-sheet-npc.html"
        }

        return data;
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Owner Only Listeners
        if (this.actor.owner) {
            // Ability Checks
            html.find('.ability-name').click(this._onRollAbilityTest.bind(this));
            html.find('.ability-modifiers').click(this._onRollAbilityTest.bind(this));

            // Initiative
            html.find('.init-label').click(this._onRollInitiative.bind(this));

            // ArtifactCheck
            html.find('.artifactcheck-label').click(this._onRollArtifactCheck.bind(this));

            // HDDice
            html.find('.hddice-label').click(this._onRollHDDice.bind(this));


            // Saving Throws
            html.find('.save-name').click(this._onRollSavingThrow.bind(this));

            // Weapons
            let handler = ev => this._onDragStart(ev);
            html.find('.weapon-button').click(this._onRollWeaponAttack.bind(this));
            html.find('li.weapon').each((i, li) => {
                // Add draggable attribute and dragstart listener.
                li.setAttribute("draggable", true);
                li.addEventListener("dragstart", handler, false);
            });
        }
        // Otherwise remove rollable classes
        else {
            html.find(".rollable").each((i, el) => el.classList.remove("rollable"));
        }

    }

    /**
     * Prompt to Clear This Sheet
     * @param {Event} event   The originating click event
     * @private
     */
    _onClearSheet(event) {
        event.preventDefault();
        new Dialog({
            title: game.i18n.localize("DCC.ClearSheet"),
            content: `<p>${game.i18n.localize("DCC.ClearSheetExplain")}</p>`,
            buttons: {
                yes: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Yes",
                    callback: () => this._clearSheet()
                },
                no: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "No"
                }
            }
        }).render(true);
    }

    /**
     * Clear out all form fields on this sheet
     * @private
     */
    _clearSheet() {
        [...this.form.elements].forEach((el) => {
            el.value = ""
        });
    }

    /* -------------------------------------------- */

    /**
     * Listen for click events on an attribute control to modify the composition of attributes in the sheet
     * @param {MouseEvent} event    The originating left click event
     * @private
     */
    async _onClickAttributeControl(event) {
        event.preventDefault();
        const a = event.currentTarget;
        const action = a.dataset.action;
        const attrs = this.object.data.data.attributes;
        const form = this.form;
    }

    /** @override */
    _onDragStart(event) {
        const li = event.currentTarget;
        const weapon = this.actor.data.data.items.weapons[li.dataset.weaponId];
        weapon.id = li.dataset.weaponId;
        const dragData = {
            type: "Item",
            actorId: this.actor.id,
            data: weapon
        };
        if (this.actor.isToken) dragData.tokenId = this.actor.token.id;
        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }

    /**
     * Prompt for a stat block to import
     * @param {Event} event   The originating click event
     * @private
     */
    _onPasteStatBlock(event) {
        event.preventDefault();
        const html = `<form id="stat-block-form">
            <textarea name="statblock"></textarea>
        </form>`;
        new Dialog({
            title: game.i18n.localize("DCC.PasteBlock"),
            content: html,
            buttons: {
                yes: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Import Stats",
                    callback: html => this._pasteStateBlock(html)
                },
                no: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            }
        }).render(true);
    }

    /**
     * Import a stat block
     * @param {string} statBlockHTML   The stat block to import
     * @private
     */
    _pasteStateBlock(statBlockHTML) {
        const statBlock = statBlockHTML[0].querySelector("#stat-block-form")[0].value;
        const parsedNPC = parseNPC(statBlock);
        console.log(this.object.data.data);
        Object.entries(parsedNPC).forEach(([key, value]) => {
            console.log(key + ' ' + value);
            if (this.form[key]) this.form[key].value = value;
        });
    }

    /* -------------------------------------------- */

    /**
     * Handle rolling an Ability check
     * @param {Event} event   The originating click event
     * @private
     */
    _onRollAbilityTest(event) {
        event.preventDefault();
        let options = {};
        if (event.currentTarget.className === "ability-modifiers") {
            options.modClick = true;
        }
        let ability = event.currentTarget.parentElement.dataset.ability;
        this.actor.rollAbilityCheck(ability, {event: event});
    }

    /**
     * Handle rolling Initiative
     * @param {Event} event   The originating click event
     * @private
     */
    _onRollInitiative(event) {
        event.preventDefault();
        this.actor.rollInitiative({event: event});

    }

        /**
     * Handle rolling Initiative
     * @param {Event} event   The originating click event
     * @private
     */
    _onRollArtifactCheck(event) {
        event.preventDefault();
        this.actor.rollArtifactCheck({event: event});

    }

    _onRollHDDice(event) {
        event.preventDefault();
        this.actor.rollHD({event: event});

    }

    /**
     * Handle rolling a saving throw
     * @param {Event} event   The originating click event
     * @private
     */
    _onRollSavingThrow(event) {
        event.preventDefault();
        let save = event.currentTarget.parentElement.dataset.save;
        this.actor.rollSavingThrow(save, {event: event});
    }

    /**
     * Handle rolling a weapon attack
     * @param {Event} event   The originating click event
     * @private
     */
    _onRollWeaponAttack(event) {
        event.preventDefault();
        let weaponId = event.currentTarget.parentElement.dataset.weaponId;
        this.actor.rollWeaponAttack(weaponId, {event: event});
    }

    /* -------------------------------------------- */

    /** @override */
    setPosition(options = {}) {
        const position = super.setPosition(options);
        const sheetBody = this.element.find(".sheet-body");
        const bodyHeight = position.height - 192;
        sheetBody.css("height", bodyHeight);
        return position;
    }

    /* -------------------------------------------- */

    /** @override */
    _updateObject(event, formData) {
        // Update the Actor
        return this.object.update(formData);
    }

}
