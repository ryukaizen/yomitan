/*
 * Copyright (C) 2017  Alex Yatskov <alex@foosoft.net>
 * Author: Alex Yatskov <alex@foosoft.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


class Display {
    constructor(spinner, container) {
        this.spinner = spinner;
        this.container = container;
        this.definitions = [];
        this.audioCache = {};
        this.responseCache = {};
        this.sequence = 0;
        this.index = 0;

        $(document).keydown(this.onKeyDown.bind(this));
    }

    definitionAdd(definition, mode) {
        throw 'override me';
    }

    definitionsAddable(definitions, modes) {
        throw 'override me';
    }

    templateRender(template, data) {
        throw 'override me';
    }

    kanjiFind(character) {
        throw 'override me';
    }

    handleError(error) {
        throw 'override me';
    }

    clearSearch() {
        throw 'override me';
    }

    showTermDefs(definitions, options, context) {
        window.focus();

        this.spinner.hide();
        this.definitions = definitions;
        this.options = options;
        this.context = context;

        const sequence = ++this.sequence;
        const params = {
            definitions,
            addable: options.anki.enable,
            grouped: options.general.groupResults,
            playback: options.general.audioPlayback
        };

        if (context) {
            for (const definition of definitions) {
                definition.sentence = context.sentence || '';
                definition.url = context.url || '';
            }
        }

        this.templateRender('terms.html', params).then(content => {
            this.container.html(content);
            this.entryScroll(context && context.index || 0);

            $('.action-add-note').click(this.onAddNote.bind(this));
            $('.action-play-audio').click(this.onPlayAudio.bind(this));
            $('.kanji-link').click(this.onKanjiLookup.bind(this));

            return this.adderButtonsUpdate(['term-kanji', 'term-kana'], sequence);
        }).catch(this.handleError.bind(this));
    }

    showKanjiDefs(definitions, options, context) {
        window.focus();

        this.spinner.hide();
        this.definitions = definitions;
        this.options = options;
        this.context = context;

        const sequence = ++this.sequence;
        const params = {
            definitions,
            source: context && context.source,
            addable: options.anki.enable
        };

        if (context) {
            for (const definition of definitions) {
                definition.sentence = context.sentence || '';
                definition.url = context.url || '';
            }
        }

        this.templateRender('kanji.html', params).then(content => {
            this.container.html(content);
            this.entryScroll(context && context.index || 0);

            $('.action-add-note').click(this.onAddNote.bind(this));
            $('.source-term').click(this.onSourceTerm.bind(this));

            return this.adderButtonsUpdate(['kanji'], sequence);
        }).catch(this.handleError.bind(this));
    }

    adderButtonsUpdate(modes, sequence) {
        return this.definitionsAddable(this.definitions, modes).then(states => {
            if (states === null || sequence !== this.sequence) {
                return;
            }

            states.forEach((state, index) => {
                for (const mode in state) {
                    const button = Display.adderButtonFind(index, mode);
                    if (state[mode]) {
                        button.removeClass('disabled');
                    } else {
                        button.addClass('disabled');
                    }

                    button.removeClass('pending');
                }
            });
        });
    }

    entryScroll(index, smooth) {
        index = Math.min(index, this.definitions.length - 1);
        index = Math.max(index, 0);

        $('.current').hide().eq(index).show();

        const body = $('body').stop();
        const entry = $('.entry').eq(index);
        const target = index === 0 ? 0 : entry.offset().top;

        if (smooth) {
            body.animate({scrollTop: target}, 200);
        } else {
            body.scrollTop(target);
        }

        this.index = index;
    }

    onSourceTerm(e) {
        e.preventDefault();

        if (this.context && this.context.source) {
            const context = {
                url: this.context.source.url,
                sentence: this.context.source.sentence,
                index: this.context.source.index
            };

            this.showTermDefs(this.context.source.definitions, this.options, context);
        }
    }

    onKanjiLookup(e) {
        e.preventDefault();

        const link = $(e.target);
        const context = {
            source: {
                definitions: this.definitions,
                index: Display.entryIndexFind(link)
            }
        };

        if (this.context) {
            context.sentence = this.context.sentence;
            context.url = this.context.url;
        }

        this.kanjiFind(link.text()).then(kanjiDefs => {
            this.showKanjiDefs(kanjiDefs, this.options, context);
        }).catch(this.handleError.bind(this));
    }

    onPlayAudio(e) {
        e.preventDefault();
        const index = Display.entryIndexFind($(e.currentTarget));
        this.audioPlay(this.definitions[index]);
    }

    onAddNote(e) {
        e.preventDefault();
        const link = $(e.currentTarget);
        const index = Display.entryIndexFind(link);
        this.noteAdd(this.definitions[index], link.data('mode'));
    }

    onKeyDown(e) {
        const handlers = {
            8: /* backspace */ () => {

            },

            27: /* escape */ () => {
                this.clearSearch();
            },

            33: /* page up */ () => {
                this.entryScroll(this.index - 3, true);
            },

            34: /* page down */ () => {
                this.entryScroll(this.index + 3, true);
            },

            35: /* end */ () => {
                this.entryScroll(this.definitions.length - 1, true);
            },

            36: /* home */ () => {
                this.entryScroll(0, true);
            },

            38: /* up */ () => {
                this.entryScroll(this.index - 1, true);
            },

            40: /* down */ () => {
                this.entryScroll(this.index + 1, true);
            },

            209: /* [ */ () => {

            },

            220: /* \ */ () => {
                this.audioPlay(this.definitions[this.index]);
            },

            221: /* ] */ () => {

            }
        };

        const handler = handlers[e.keyCode];
        if (handler) {
            e.preventDefault();
            handler();
        }
    }

    noteAdd(definition, mode) {
        this.spinner.show();
        return this.definitionAdd(definition, mode).then(success => {
            if (success) {
                const index = this.definitions.indexOf(definition);
                Display.adderButtonFind(index, mode).addClass('disabled');
            } else {
                this.handleError('note could not be added');
            }
        }).catch(this.handleError.bind(this)).then(() => this.spinner.hide());
    }

    audioPlay(definition) {
        this.spinner.show();

        for (const key in this.audioCache) {
            this.audioCache[key].pause();
        }

        audioBuildUrl(definition, this.responseCache).then(url => {
            if (!url) {
                url = '/mixed/mp3/button.mp3';
            }

            let audio = this.audioCache[url];
            if (audio) {
                audio.currentTime = 0;
                audio.play();
            } else {
                audio = new Audio(url);
                audio.onloadeddata = () => {
                    if (audio.duration === 5.694694 || audio.duration === 5.720718) {
                        audio = new Audio('/mixed/mp3/button.mp3');
                    }

                    this.audioCache[url] = audio;
                    audio.play();
                };
            }
        }).catch(this.handleError.bind(this)).then(() => this.spinner.hide());
    }

    static entryIndexFind(element) {
        return $('.entry').index(element.closest('.entry'));
    }

    static adderButtonFind(index, mode) {
        return $('.entry').eq(index).find(`.action-add-note[data-mode="${mode}"]`);
    }
}
