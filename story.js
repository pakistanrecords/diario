// Created with Squiffy 5.1.2
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = 'ddfb';
squiffy.story.id = '3e9ebf0006';
squiffy.story.sections = {
	'_default': {
		'text': "<!--\n\n# EL DIARIO DE FRAN BAXTER\n\nIFID: 6407CD62-DD53-4F44-836E-F47A0A8E7204\n\n-->",
		'passages': {
		},
	},
	'ddfb': {
		'text': "<h1 id=\"el-diario-de-fran-baxter\">El diario de Fran Baxter</h1>\n<p><a class=\"squiffy-link link-section\" data-section=\"3 y 4 de noviembre de 1996\" role=\"link\" tabindex=\"0\">3 y 4 de noviembre de 1996</a>. Un dos tres por mí y por mis nuevos amigos</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Día de la Virgen de Guadalupe de 2007\" role=\"link\" tabindex=\"0\">Día de la Virgen de Guadalupe de 2007</a>. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"10 de enero de 2009\" role=\"link\" tabindex=\"0\">10 de enero de 2009</a>. Y me gana el llanto al amanecer</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Pendientes\" role=\"link\" tabindex=\"0\">Pendientes</a> | <a class=\"squiffy-link link-passage\" data-passage=\"Créditos\" role=\"link\" tabindex=\"0\">Créditos</a> | <a class=\"squiffy-link link-passage\" data-passage=\"Licencia\" role=\"link\" tabindex=\"0\">Licencia</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue1\" role=\"link\" tabindex=\"0\">Empezar</a></p>",
		'passages': {
			'Pendientes': {
				'text': "<h2 id=\"pendientes\">Pendientes</h2>\n<ul>\n<li>Material audiovisual.  </li>\n<li>Subir a GitHub.\n– Escribir proyecto.</li>\n</ul>",
			},
			'Créditos': {
				'text': "<p>:)</p>",
			},
			'Licencia': {
				'text': "<p>CC BY-SA 4.0</p>",
			},
		},
	},
	'_continue1': {
		'text': "<h2 id=\"-a-class-squiffy-link-link-section-data-section-3-y-4-de-noviembre-de-1996-role-link-tabindex-0-3-y-4-de-noviembre-de-1996-a-\"><a class=\"squiffy-link link-section\" data-section=\"3 y 4 de noviembre de 1996\" role=\"link\" tabindex=\"0\">3 y 4 de noviembre de 1996</a></h2>\n<!--\n _  ___   ___   __   \n/ |/ _ \\ / _ \\ / /_   1996 1996 1996 1996 1996 1996 1996 1996 \n| | (_) | (_) | '_ \\  1996 1996 1996 1996 1996 1996 1996 1996  \n| |\\__, |\\__, | (_) | 1996 1996 1996 1996 1996 1996 1996 1996 \n|_|  /_/   /_/ \\___/  1996 1996 1996 1996 1996 1996 1996 1996 \n-->",
		'passages': {
		},
	},
	'3 y 4 de noviembre de 1996': {
		'text': "<p><img src=\"images/IMG_1642.JPG\"></p>\n<p>—Sonríe a la cámara —dice Alejandra Casandra. Trae puesta mi camisa favorita, la negra con rayas rojas, de franela; y apunta su Betamax hacia mí. Yo: {rotate:camisa polo, jodidona:pantalón de pana, beige:adidas, enough said:sombrero, vaquero}. Camino hacia {rotate:la cámara:Alejandra} con una cerveza en cada mano, me abro paso a través de los asistentes a una fiesta en la que me encuentro {rotate:contra toda probabilidad:against my better judgement}.<br>En el sonido que le rentamos al Maza suena una cinta: Los Tigres del Norte. Trato de bailar, seguro me veo ridículo pero no me importa y le alcanzo una cerveza a {rotate:Alejandra:la cámara:mai lob}.<br>—Gracias —dice. Pone su cámara sobre mesa en la que había desplegado su escaparate de fanzines y agarró la cerveza. Poso mi mano suavemente en la curva de su cintura y veo los fanzines, fotocopias en blanco y negro, portadas impresas en papel bond de colores, hechas a mano, máquina, tijera y pegamento. A nadie en la fiesta parecen importarle los fanzines de Alejandra y los odio a todos un poco por es. Alejandra se ríe de algo.<br>Un grupo de juniors cantan al lado de un asador lleno de carne: {rotate:&quot;juventudes del partido&quot;:“ganado sin garrapatas que llevo pal extranjero”, entonan, felices}. Pakistán Records está a punto de debutar en sociedad durante la fiesta de &quot;cierre de campaña&quot; que el candidato regala a &quot;las juventudes del partido”.<br>—Ya casi me tengo que ir —digo.<br>—¿A Piedras? —pregunta Alejandra.<br>—Sí —contesto y le doy un trago a la cerveza—. Tengo que ir por Pancho y Mubarak.<br>—¿<a class=\"squiffy-link link-passage\" data-passage=\"Y Las Bulbas\" role=\"link\" tabindex=\"0\">Y Las Bulbas</a>? —pregunta Alejandra.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue2\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'Y Las Bulbas': {
				'text': "<h1 id=\"las-bulbas-i-\">Las Bulbas (I)</h1>\n<p>Cherry encontró un teléfono público afuera de una cantina con un nombre fabuloso: el Bar Corea del Sur.<br>Buscaba en su mochila un papel con un número telefónico escrito: el hotel donde se hospedaba la gente de Pakistán Records, ¿cómo se llamaba?. Debía estar por ahí, en algún lugar. Lodi se había quedado en la central de autobuses cuidando las maletas, ahí cruzando la calle. Beto, el hermano de Cherry, andaba en una taquería a media cuadra de ahí comprando algo de cenar.<br>No encontraba el número de teléfono.</p>",
			},
		},
	},
	'_continue2': {
		'text': "<p>Moncho Zen Ando y Larissa Double Coil, i.e. Los Turistas de Calcetín Blanco, regresan con caballitos y aliento alcohólico, ambos vestidos como si fueran a salir en la cabalgata. Larissa, sonriente, carga una botella de Morgan como si fuera un bebé pequeño.<br>—¿Cómo ves mi, Fran? —pregunta Moncho, cagado de la risa—: pa pasar desapercibidos.<br>—Falta la redshirt, cabrón.<br>—Guárdame una de cada una —dice Larissa. Señala los fanzines de Alejandra con el caballito. Trae un sombrero mexicano impresionante.<br>—A huevo, doctora.<br>—Aquí ya no soy doctora, guapa.<br>—No mames —me sobresalto—, vieras cómo le cagaba que le dijeran doctora back in Barcelona.<br>—En una tocada, —carcajea Moncho—, esta pendeja, se andaba agarrando a madrazos con una morra.<br>—Ah —Larissa, indignada—: seas mamón. Ella empezó.<br>—Oh, really?<br>—Sí: yo estaba tocando muy tranquila cuando me gritó &quot;doctoooooor del Campooo&quot;.<br>Risas.<br>—Larissa —dice Alejandra luego de un breve silencio—, entonces.<br>Larissa.<br>—Oye, Fran —dice Moncho, caballito en mano—. Parece que te anda buscando este güey, ¿cómo se llama? El de la casa.<br>—Lucio.<br>—Ese puñetas —bebe de su tequila—. Te anda buscando y se ve preocupado.<br>—Gracias —contesto.<br>—De Nancy.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue3\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue3': {
		'text': "<p>Fran Baxter <a class=\"squiffy-link link-passage\" data-passage=\"cruza el patio hasta la casa\" role=\"link\" tabindex=\"0\">cruza el patio hasta la casa</a>. Larissa y Moncho le empiezan a hacer plática a Alejandra Casandra.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue4\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'cruza el patio hasta la casa': {
				'text': "<p>No sé de quién es esta casa. Este sillón es muy elegante, siento que lo voy a ensuciar nomás de verlo y estoy sentado en él desde hace como quince minutos. Seguro lo que cuesta este sillón nos paga los honorarios y el hospedaje y las comidas y el alcohol y las drogas que no son alcohol durante toda la semana. Bueno, no sé si el sillón, pero sí la salita completa. Si le agregamos el leiziboi donde está sentado Lucio pues igual y una semana más. Los libros de arte, los cofiteibol, pagan varias carnes asadas, ¡son Taschen! Se alcanzan a escuchar las cumbias del Maza pero <em>sobre todo</em> se escucha a Fela Kuti &amp; Africa 70 en el piso de arriba. Quién viera a las juventudes priístas, tan eclécticas en sus sensibilidades, no me lo habría imaginado jamás. Ya estoy muy al borde del sillón. Fela Kuti no ayuda, pero para nada. No mames, qué pinche serie de equivocaciones tan pendejas me trajeron hasta aquí.<br>—Perdón, Fran —dice Paulina, {sequence:una morra de sabinas:la hija de un empresario local:una lideresa one percent principiante:la novia de Lucio:mi exnovia:la organizadora del evento}—. Ojalá firmen mañana los coordinadores y te pagamos en la semana siguiente.<br>Juventudes del partido {rotate:entran y salen:salen y entran} de la casa. Si algo tienen en común todos es que no entienden que cuando uno dice &quot;no tengo dinero&quot; significa &quot;no tengo un puto peso&quot;. Para ellos, no tener dinero es no poder ir a San Antonio esta semana, váyanse a la verga.<br>—Aliviánate, carnal —dice Lucio. Neorrositense, hijo de doctor, dueño de la casa, novio de Paulina, el encargado de las finanzas de Juventudes Partidistas, S.A. de C.V., donde todos llevamos puesta la playera, literal y metafórica, del candidato priísta. No hay un átomo agradable en este güey.<br>&quot;Supongo que hay que vencerlos desde adentro&quot;, dijo Bobo Lafragua hoy en la mañana que hablamos por teléfono. &quot;Ponte la pinche playera&quot;, agregó; y colgó.<br>—Bueno: tengo una tocada que coordinar y todavía tengo que ir a recoger a unos jomis. Ya me están esperando, de hecho.<br>Me levanto del sillón.<br>—Unos... ¿<em>jomis</em>, Fran?<br>—Sí.<br>—Wey. Te he visto llorar porque te echaron tierra en el receso. Nadie te cree esa pinche pose de wey de barrio, mamón.<br>—Teníamos como seis años.<br>—Teníamos catorce. Nos conocimos en la secundaria.<br>—Ya me voy, Paulina. Bai, Lucio. Me carga la verga.<br>—Pero llegas a tiempo, ¿verdad? Viene el candidato y tú no me vas a hacer quedar mal, cabrón.<br>—Me vale verga tu pinche candidato —pensé, pero no dije. Más bien contesté algo así como<br>—OK, Paulina.<br>y me fui.</p>",
			},
		},
	},
	'_continue4': {
		'text': "<p>Había un fantasma pidiendo rai camino a Piedras Negras. No le hice caso: ahorita no hay tiempo para esas indulgencias.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue5\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue5': {
		'text': "<p>Los Nebulosos Darwins, i.e. Pancho Taylor y Mubarak Saavedra, han estado tocando en este apestoso cantabar jaguayano los últimos cinco meses, casi a diario. Lo hacen a cambio de un par de cervezas y un pago semanal que apenas cubre el departamento que están rentando a unos metros del puente internacional. Acaban de tocar un popurrí acústico de Creedence. El cantabar está casi solo y una persona aplaude desde {rotate:un oscuro rincón del bar:su borrachera imaginaria}.<br>Se echan un par de rolas más. <a class=\"squiffy-link link-passage\" data-passage=\"Mubarak canta\" role=\"link\" tabindex=\"0\">Mubarak canta</a> mientras <a class=\"squiffy-link link-passage\" data-passage=\"Pancho toca su guitarra\" role=\"link\" tabindex=\"0\">Pancho toca su guitarra</a>. Muy distinto a lo que regularmente hacen porque así es el güeso. Tocan sobre una tarima de madera de aspecto muy poco confiable. No hay más de diez clientes en el bar.<br>Los Nebulosos terminaron su número alrededor de las nueve y media pe eme, para nada el horario estelar.<br>Pancho Taylor desconecta sus cosas y las echa en una samsonait negra ruleteadísima. Mubarak hace lo mismo con el micrófono y camina hacia la barra. El cantinero lo recibe con dos fantas. Lo alcanza Pancho, acaba de guardar la guitarra en el estuche.<br>Los observé. Estuvieron un buen rato en silencio. De vez en cuando Mubarak decía algo y Pancho asentía o negaba con la cabeza. Sin muchas ganas el cantinero les entregó un platito con cacahuates.<br>Me acerqué a la barra y me senté junto a Mubarak, quien dibujaba mandalas en una servilleta con el sudor de la fanta.<br>—Buenas noches, caballeros —saludo. Los Nebulosos voltean a verme al mismo tiempo.<br>—Buenas —contesta Mubarak. Pancho sólo alza un poco su fanta.<br>—¿Los Nebulosos?<br>—En persona —dijo Mubarak.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue6\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'Mubarak canta': {
				'text': "<h1 id=\"mubarak-saavedra-i-\">Mubarak Saavedra (I)</h1>\n<blockquote>\n<p>If I only had a dollar<br>For every song I´ve sung<br>And every time I had to play<br>While people sat there drunk.</p>\n</blockquote>\n<p>Mubarak era hijo de franquistas, así que su carrera empezó en una banda de punk cuando tenía unos quince años. Y resultó que sus papás tenían razón: el punk no lo llevó a nada bueno.<br>Poco antes de cumplir los dieciocho emigró a México donde fue parte de un inusitado interés en la música con vagos tintes flamencos. El interés en lo español por lo español era tal que Mubarak Saavedra fue parte de varias agrupaciones de neo-flamenco aún sin haber cantado otra cosa que jarcor panc en toda su vida.<br>Fue durante una de sus aventuras de cybercantaor que Mubarak Saavedra decidió fumar sapo. Al día siguiente renunció a la banda y escribió &quot;Malakatonche&#39;s World Parade&quot;, una {rotate:suite poética:ópera rock} que grabaría unos años después.<br>Pero primero debía, desde luego, peregrinar a Acapulco.</p>",
			},
			'Pancho toca su guitarra': {
				'text': "<h1 id=\"pancho-taylor-i-\">Pancho Taylor (I)</h1>\n<blockquote>\n<p>The moon just went behind the clouds\nTo hide it&#39;s face and cry</p>\n</blockquote>\n<p>Guitarrista de gustos sencillos, Pancho toca una Telecaster conectada a un overdraiv y un dilei.<br>Hijo de una tercera generación de fara faras y cumbiamberos de Tijuana, desde pequeño visitó los burdeles de Tijuana, si bien los más decentes y de buena reputación. Fue en uno de esos burdeles que el adolescente Francisco perdió su virginidad con una maravillosa jovencita conocida como Geraldine.<br>—Tú puedes decirme Claudia —le suspiraba ella al oído bajo la luz de la luna.<br>—Claaaaaudia —bromeaba él. Ella reía.<br>—¡No me asustes!<br>Al menos eso cuenta {rotate:una novela:autobiografía:una novela que se hace pasar por autobiografía:una autobiografía que se hace pasar por una novela} publicaada por el instituto de cultura del estado a principios de los noventa. El título del libro es sensacional: <em>Con el rock en las venas: crónicas desde la trinchera del rock en tu idioma</em>. ¡Chingas! Debería leerlo.<br>Es curioso porque cuando uno lo conoce uno pensaría que por sus venas no corre ni el rock: es una especie de vampiro motorizado, mitad gótico norteño y mitad ángel del infierno, a medio camino entre la carroza fúnebre y la jarli.</p>",
			},
		},
	},
	'_continue6': {
		'text': "<p>—Soy Fran Baxter —&quot;y me siento ridículo&quot;, pensé—: <a class=\"squiffy-link link-passage\" data-passage=\"el productor\" role=\"link\" tabindex=\"0\">el productor</a><br>—Ay, de veras, ¿qué fue eso? —escuché y una mano enorme me hizo a un lado. Es Ulises, el dueño del cantabar, un fisicoculturista calvo de un metro noventa vestido como padrote de rancho.<br>—¿Qué onda, Ulises? —pregunto.<br>—¿Qué onda, Fran? —pregunta Ulises, sin esperar una respuesta, y agrega—¿En serio no pueden tocar algo que le guste a la gente?<br>—A mí me gustó, Ulises —salgo en defensa de Los Nebulosos.<br>—Ay, Fran —Ulises, sonrisa falsa—, cállate.<br>—¿Como qué, Ulises? —pregunta Pancho.<br>—No sé, cabrón —dice Ulises; empieza a caminar hacia la barra—. Una canción de protesta o una balada romántica. Yo qué sé. Ustedes son los músicos. Pero pinche Creedence nadie sabe cantarlas, están en inglés.<br>—Y estamos en la frontera —digo, sordeado.<br>—Cállate, Fran.<br>—Eso no es lo que hacemos —dice Pancho.<br>—Pues háganlo. Pero en fin. Dice Sandino que le ayuden a conectar su guitarra y sus pedales. Sirvan de algo.<br>—Yo le ayudo a Sandino a instalarse —salgo huyendo—. Usted siga negociando la estética de su establecimiento con sus empleados.<br>—No somos sus empleados —dice Pancho.<br>—Y mi estética no está abierta a negociaciones —agrega Ulises y camina de vuelta a la cocina.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue7\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'el productor': {
				'text': "<p>La verdad es que he dedicado <a class=\"squiffy-link link-passage\" data-passage=\"más tiempo a la academia\" role=\"link\" tabindex=\"0\">más tiempo a la academia</a> que al ejercicio de mis conocimientos en el mundo real. Si algún talento quedaba en mí, éste ha muerto o está mosqueando o se habrá disuelto en el ácido de la escritura y lectura de <a class=\"squiffy-link link-passage\" data-passage=\"tesis\" role=\"link\" tabindex=\"0\">tesis</a>, tesinas, artículos, journals y todo eso que los académicos hacen pasar por textos legibles a los ojos de sus iguales.<br>Una maestría en {rotate:arte sonoro:compensar mi falta de talento musical} no lo llevan muy lejos aunque el papelito pertenezca a la Universitat de Barcelona.  </p>",
			},
			'más tiempo a la academia': {
				'text': "<p>Tampoco es que me falte calle: he tocado en un par de bandas y escribo sobre música para un periódico de Saltillo y varios fanzines del noreste del país.</p>",
			},
			'tesis': {
				'text': "<p>Durante años, la única conexión que Fran Baxter tuvo con la realidad musical fue, irónicamente, su directora de tesis: Larissa Double-Coil, voz, guitarra y teclados de Los Turistas de Calcetín Blanco, banda mexicana de pop psicodélico más o menos conocida en el inframundo catalán en la que Fran Baxter militó durante un par de semanas hasta que les cayó la oportunidad de irse de gira por los países nórdicos. Fran Baxter tuvo que permanecer en Barcelona: eran fechas de exámenes.</p>",
			},
		},
	},
	'_continue7': {
		'text': "<p>La ventanilla del copiloto tiene una hoja de papel continuo con la impresión &quot;PAKISVÁN&quot;. Se está despegando la cinta adhesiva que sostiene una de sus esquinas. Mubarak trata de volver a ponerla en su lugar, sin éxito.<br>—La tocada es aquí en corto —digo mientras nos subimos a la Pakisván—. Como les digo, todavía no hay mucho varo pero vamos a hacer cosas interesantes. El lineup de la disquera está bien interesante, ya verán. Lo que queremos armar no lo tiene nadie.<br>—¿Y qué quieren armar exactamente?<br>—Música monster.<br>Silencio.<br><a class=\"squiffy-link link-passage\" data-passage=\"Al volante de la Pakisván\" role=\"link\" tabindex=\"0\">Al volante de la Pakisván</a> y con Los Nebulosos Darwins de cargamento, agarré la 57 por ahí de las diez.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue8\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'Al volante de la Pakisván': {
				'text': "<h2 id=\"pakisv-n-i-\">Pakisván (I)</h2>\n<p>Mi van había visto mejores tiempos. Más limpios, sí, pero también más aburridos. A eso me refiero con &quot;mejores&quot;. Huele a {sequence:cartablanca azorrillada:delicados a medio fumar:pedos viejos:mota:<a class=\"squiffy-link link-passage\" data-passage=\"decadencia\" role=\"link\" tabindex=\"0\">decadencia</a>:mis sueños}. El sillón en el que va acostado Pancho <a class=\"squiffy-link link-passage\" data-passage=\"era blanco\" role=\"link\" tabindex=\"0\">era blanco</a>, cabrón.<br>Ahora parece el mapamundi de un mundo que es una fiesta.</p>",
			},
			'decadencia': {
				'text': "<p>No sé de qué sueños hablas, Fran Baxter.</p>",
			},
			'era blanco': {
				'text': "<p>No mames, joder. Risas.</p>",
			},
		},
	},
	'_continue8': {
		'text': "<p>No debí haber fumado. {rotate:No tanto:No en la Rosita-Piedras, en la Pakisván, arriba de los cien kilómetros por hora, no:No}. Los Nebulosos <a class=\"squiffy-link link-passage\" data-passage=\"pusieron su demo en el estéreo de la Pakisván\" role=\"link\" tabindex=\"0\">pusieron su demo en el estéreo de la Pakisván</a>. Ya quiero producirlos.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue9\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'pusieron su demo en el estéreo de la Pakisván': {
				'text': "<p>Los Nebulosos Darwins, &quot;Mars Station&quot;, en el demo <em>mlktnch3</em> de 1995.  </p>\n<audio src=\"music/mars.mp3\" autoplay controls>",
			},
		},
	},
	'_continue9': {
		'text': "<p>—¿Y dónde es la tocada? —pregunta pancho desde el sillón que traemos en la Pakisván.<br>—En una villa de Sabinas —explico—. La casa de un junior local. Si todo sale bien estos chavos van a conseguirnos tocadas en otras partes a lo largo de la semana. Igual y hasta más.<br>—¿Y si no todo sale bien? —pregunta Pancho.<br>—Nos vamos al ejido a grabar.<br>—¿El ejido?<br>Les cuento un poco sobre la historia de Pakistán Records: la fundación de la disquera, Bobo Lafragua, la casona inglesa, los terrenos ejidales, la mutilación de ganado, Alejandra Casandra, los chamanes ejidatarios, el Magno Concurso Interranchonal de Elaboración de Sotol Artesano “Yo ya me voy a morir”, nuestros estudios amateurs de criptozoología coahuilense, Sandro de Amecameca, don Tito y El Vikingo, El Gran Asalto al Museo Pape, Los Turistas de Calcetín Blanco, etc. Ya se terminó el demo nebuloso. Están cabrones.<br>Mubarak guarda el caset y {sequence:Pancho sintoniza el fantasma de una difusora lejana:</p>\n<blockquote>\n<p>&quot;Sobre el piso de la Pakisván estaban regados los flyers de la fiesta de juniors. Fran Baxter las había impreso pensando que se trataría de un evento público.<br>Según la información del flyer la fiesta debería haber empezado dos horas antes de que Fran Baxter llegara a Piedras Negras.<br>Ahí en el flyer, entre otros nombres tan insólitos como Cáspita y Los Atónitos, Sandro de Amecameca, Los Turistas de Calcetín Blanco y Las Bulbas, estábamos nosotros, Los Nebulosos Darwins, dueto de voz y guitarra que en unas semanas empezaría a grabar su primer LP de calidad profesional\n}.<br>Suenan Carlos y José.<br>—¿Qué ciudad son esas luces?<br>—Sabinas.<br>—Parecen rascacielos.<br>Le explico que es un espejismo. Es por el frío, creo. Pancho Taylor nos escucha en silencio.<br>Pasamos Nueva Rosita. No entramos pero les cuento de las hamburguesas al carbón que están <a class=\"squiffy-link link-passage\" data-passage=\"frente a la Fortunato\" role=\"link\" tabindex=\"0\">frente a la Fortunato</a>.<br>—¿No se supone que Los Nebulosos Darwins son una banda como de siete cabrones?<br>—Éramos —dice Mubarak—. Hemos tenido rotación de personal.<br>—En el demo ya nomás somos este cabrón y yo haciendo todo.  </p>\n</blockquote>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue10\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'frente a la Fortunato': {
				'text': "<blockquote>\n<p>&quot;Yo no sabía qué era &#39;la fortunato&#39;.&quot;</p>\n</blockquote>",
			},
		},
	},
	'_continue10': {
		'text': "<p>El camino de regreso está lleno de fantasmas.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue11\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue11': {
		'text': "<p>Ya llegamos a Sabinas. Pasa, un poco, de la medianoche. De paseo de los liones salimos al libramiento, mano derecha en el estadio, vuelta en el gimnasio como yendo al río y donde topa, por ahí, hay casas y villas muy elegantes. {rotate:La casa de Lucio está rodeada por un alto muro de piedra pintado de negro:  </p>\n<blockquote>\n<p>&quot;Quince años después esas casas pasarían una silenciosa noche bajo el agua&quot;</p>\n</blockquote>\n<p>}. Hay unos quince carros estacionados afuera, últimos modelos con calcomanías {secuence:del logo del partido:del rostro sonriente y redondo del candidato:del eslogan de la campaña}.<br>Se escucharía el melancólico y milenario rumor del río Sabinas si el Maza no fuera un genio: &quot;Falsa Traición&quot; sonaba desde varias cuadras antes de llegar.<br>Me estacioné detrás de la combi de Larissa, considerablemente más cuidada y amada que la mía.<br>—La Turisván —señalo—. Ahí viajan Los Turistas de Calcetín Blanco.<br>—Me laten esos güeyes —dice Mubarak—, no sé qué piense aquí mi compañero.<br>—Son buenos.<br>—A veces se la prestan a Las Bulbas.<br>—Hace poco nos rolaron un caset de esas morras, muy chingón.<br>—Nebuván me suena a medicamento controlado. Mola.<br>—También van a tocar ahorita, ¿verdad?<br>—Sí. ¿Conocen a Sandro de Amecameca?<br>—No.<br>—No.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue12\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue12': {
		'text': "<p>El olor de la carne asada es erótico y un muro con botellas de coca rotas protege a los inocentes habitantes de esta villa de los inmencionables peligros del mundo exterior.<br>Todos están pedísimos. Llego buscando la mirada a Alejandra y no la veo, a lo mejor se fue al baño. Saludan al Maza, sonidero. Don Tito y Primero Vallezar ya sacaron los de caña. Segundo Vallezar está dormido en una mecedora con una tecate en los güevos. Redshirts por todas partes. &quot;5 de té&quot;, La Rebelión de Teo Sánchez. ¿Dónde está Alejandra?<br>Los Pakistán se reunieron en la barra. Todo parece estarse llevando en relativa tranquilidad. Cierro los ojos. Los abro. Estoy muy pacheco, I can&#39;t fucking do this.<br>&quot;PAQUISTÁN (sic) RECORDS&quot;. Alguien usó un marcador permanente para agregar el &quot;(sic)&quot; en la lona impresa.<br>Sandro está gritando. Su asistente parece asustado. {rotate:Un redshirt:&quot;Oye, tu raza se está poniendo pesada&quot;}. Alejandra, ya la encontré, está saliendo de la casa. Me sonríe y me saluda. La siguen Los Turistas. Moncho voltea a verme y me saluda con un movimiento de cabeza. Trae la punta de la nariz manchada de blanco. Larissa está bebiendo de <a class=\"squiffy-link link-passage\" data-passage=\"la botella de Morgan\" role=\"link\" tabindex=\"0\">la botella de Morgan</a>.<br>—Ustedes abren, perros.<br>—No mames —Los Nebulosos a coro.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue13\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'la botella de Morgan': {
				'text': "<h2 id=\"sandro-s-shades-i-\">Sandro&#39;s Shades (I)</h2>\n<p>—Pregúntale a este gringo cara de meco que qué pedo con esas pinches mamadas que están ahí colgadas —dijo el hombre del sombrero tejano, lentes de Poncharelo, traje de vestir alguna vez blanco hoy más bien aperlado y botas de piel de avestruz: Sandro de Amecameca. Hablaba con su asistente, un hombre calvo y diminuto cuyo nombre nadie sabía: su patrón nunca se dirigía a él por su nombre.<br>El Vikingo cuidaba de los fanzines de Alejandra, quien ya se había instalado cómodamente en la barra y no parecía tener intenciones de moverse en un rato. El asistente de Sandro tosió suavemente para exigir la atención del Vikingo y dijo, ignorando y pasando por alto que El Vikingo no hablaba ni madres de español pero entendía a la perfección el dialecto rústico del norte profundo mexicano:<br>—Mr. Sandro would like me to inquire you regarding the nature of the venue’s decoration —dijo, señalando las llantas de yip, ruedas de carreta y calaveras de res que colgaban sobre la pared detrás del escenario.<br>—Los cráneos están vergas pero esas llantas y ruedas están de la verga.<br>—Mr. Sandro fancies the skulls but finds the wheels unsavory.<br>El Vikingo no contestó porque no tenía una respuesta. “Jesus fucking Christ”, pensó. Miró hacia el otro extremo del patio, donde los muchachos priístas estaban poniendo una canción de moda en la grabadora. Don Tito platicaba con el Dueto Valle Zar junto al asador. Ellos tres eran los únicos que habían comprado carne para asar durante la fiesta.  </p>",
			},
		},
	},
	'_continue13': {
		'text': "<p>—<a class=\"squiffy-link link-passage\" data-passage=\"Van ustedes y luego Sandro\" role=\"link\" tabindex=\"0\">Van ustedes y luego Sandro</a>, ¿está bien si tocan con él? Nomás por hoy, su banda tuvo un problema. Están de pedo sus pinches rolas. Puro círculo, los acompaño en la acústica para que me vean.<br>—Va —dice Pancho.<br>—Este güey es el Mazapán —dijo Fran Baxter señalando a un güero rechoncho y sonriente—. Es el del sonido. El que les conté que tiene un grupo.<br>Thumbs up del sonriente Mazapán.<br>—Quiúboles —contesta Pancho.<br>—¿Qué onda? —saluda Mubarak.<br>El Mazapán empieza a repartir amplis y micrófonos. Ya era hora de que la máquina de Pakistán Records empieza a hacer ruidos.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue14\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'Van ustedes y luego Sandro': {
				'text': "<h2 id=\"sandro-s-shades-ii-\">Sandro&#39;s Shades (II)</h2>\n<p>—¿Qué chingados son estas mamadas? —preguntó Sandro echándole un vistazo a los fanzines de Alejandra.<br>—Sandro de Amecameca would love to know more about these publications, good sir.<br>—¿Y dónde vergas están los pinches músicos que les encargué? —preguntó Sandro—. Seguro van a traer a cualquier pendejo al que mis canciones se la van a meter doblada.<br>—Mr. Sandro is worried about the absence and slash or technical capabilities of the backing band he politely required from you in his contract.<br>—They should arrive any moment now —contestó el Vikingo—. Don’t worry, Mr. Sandro, no preocupado, todo OK, todo OK.<br>Sandro de Amecameca parecía mirar fijamente a El Vikingo desde un lugar más allá de la oscuridad de sus lentes de poncharelo.<br>—Quiero una pinche chela —dijo Sandro.<br>—Mr. Sandro is feeling thirsty —tradujo su asistente.<br>El Vikingo les propuso, en perfecto inglés del sur de Texas, que fueran por una chela. Supuso que nadie se robaría los fanzines de Alejandra y no habría problema si los descuidaba un rato.<br>Caminaron hacia la barra donde un muy joven barman vestido con chamarra del SNTE preparaba martinis y mojitos mientras que un gordo enfundado en una members onli gris destapaba cervezas nacionales e internacionales para un grupo de juniors priístas.  </p>",
			},
		},
	},
	'_continue14': {
		'text': "<p>Chelas.<br>—Les voy a traer unas chelas. ¿Quieres una, Mazapán?<br>—Al rato. Orita pura agua.<br>Camino hacia {rotate:la barra:Alejandra}.<br>—¿Hey, cómo te fue?<br>—Todo bien. Ya se van a conectar.<br>Me abraza. La rodeo con mi brazo.<br>—¿<a class=\"squiffy-link link-passage\" data-passage=\"Vendiste fanzines\" role=\"link\" tabindex=\"0\">Vendiste fanzines</a>?<br>—No. Pero está bien, prefiero vendérselos a alguien que los va a leer.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue15\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'Vendiste fanzines': {
				'text': "<h2 id=\"sandro-s-shades-iii-\">Sandro&#39;s Shades (III)</h2>\n<p>—¿Descuidando el bisnes, mai lirol Vaikin? —preguntó Alejandra.<br>—I don’t think nobody is gonna to steal your zines, Ale.<br>—Nah, yo tampoco.<br>—¿Qué le sirvo a los señores? —preguntó el de la members onli.<br>—Tecate Light —contestó Sandro.<br>—Carta Blanca —pidió El Vikingo.<br>—No —dijo Sandro—: mejor una cuba.<br>—Una limonada sin hielos —dijo el asistente.<br>—Pari jard, ¿eh? —dijo Alejanda dándole un codazo al asistente quien respondió con una tímida sonrisa.</p>",
			},
		},
	},
	'_continue15': {
		'text': "<p>Empiezan a sonar {rotate:Los Nebulosos:Los Reyes Locos}.<br>Esta barra se parece a la del cantabar.<br>El Mazapán tras los controles. Los Nebulosos en listos. Thumbs up. Thumbs up.<br>&quot;Este es un ritmo suave pa&#39; bailar, suave pa&#39; ba...&quot;.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue16\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue16': {
		'text': "<p>Silencio y gente hablando a gritos en medio del silencio y el melancólico y milenario rumor del Río Sabinas.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue17\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue17': {
		'text': "<p>—Guess who&#39;s coming, guess who&#39;s coming! —exclamó Mubarak al micrófono.<br>—¿Empezamos con ”El Río”? —preguntó Pancho.<br>—“El Río” —confirmó Mubarak. Tomó el micrófono con ambas manos.<br>—{sequence:One...:Two...:Three...:¡Chinguen a su madre los del PRI!}  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue18\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue18': {
		'text': "<h2 id=\"-a-class-squiffy-link-link-section-data-section-d-a-de-la-virgen-de-guadalupe-de-2007-role-link-tabindex-0-d-a-de-la-virgen-de-guadalupe-de-2007-a-\"><a class=\"squiffy-link link-section\" data-section=\"Día de la Virgen de Guadalupe de 2007\" role=\"link\" tabindex=\"0\">Día de la Virgen de Guadalupe de 2007</a></h2>\n<!--\n ____   ___   ___ _____\n|___ \\ / _ \\ / _ \\___  | 2007 2007 2007 2007 2007 2007 2007 2007 \n  __) | | | | | | | / /  2007 2007 2007 2007 2007 2007 2007 2007 \n / __/| |_| | |_| |/ /   2007 2007 2007 2007 2007 2007 2007 2007 \n|_____|\\___/ \\___//_/    2007 2007 2007 2007 2007 2007 2007 2007 \n-->",
		'passages': {
		},
	},
	'Día de la Virgen de Guadalupe de 2007': {
		'text': "<p>Espero a Alejandra en la mesa del Sanborn&#39;s donde quedamos de vernos, en Guadalajara. Le doy un trago al café. Le pongo azúcar. Le doy otro trago. No me gusta. Ya llegó. {sequence:Hacemos contacto visual:Sonríe:Sonrío:Me sonrojo como si tuviera 14 años}. <a class=\"squiffy-link link-passage\" data-passage=\"Me pongo de pie\" role=\"link\" tabindex=\"0\">Me pongo de pie</a>.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue19\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'Me pongo de pie': {
				'text': "<p>Alejandra camina hacia la mesa. Beso al aire. Abrazo melancólico. Nos sentamos.<br>—Ya pediste —dice y señala mi café. Sonríe.<br>—Sí, ¿quieres pedir algo?<br>—Espérame —se levanta; se quita su chamarra y la deja en el respaldo de la silla.<br>—OK.<br>Camina hacia la caja. Le miro las nalgas. No puedo evitarlo. Siempre voy a {rotate:voltear a ver:añorar:recordar en terapia:dibujar en el aire} las nalgas de mis exnovias. Pinche macho. Alejandra viene de regreso.<br>—Hoy no abren el bar —dice Alejanda—. Ya pagué tu café. Vámonos a una cantina.</p>",
			},
		},
	},
	'_continue19': {
		'text': "<h2 id=\"-a-class-squiffy-link-link-section-data-section-10-de-enero-de-2009-role-link-tabindex-0-10-de-enero-de-2009-a-\"><a class=\"squiffy-link link-section\" data-section=\"10 de enero de 2009\" role=\"link\" tabindex=\"0\">10 de enero de 2009</a></h2>\n<!--\n ____   ___   ___   ___  \n|___ \\ / _ \\ / _ \\ / _ \\  2009 2009 2009 2009 2009 2009 2009 2009 \n  __) | | | | | | | (_) | 2009 2009 2009 2009 2009 2009 2009 2009 \n / __/| |_| | |_| |\\__, | 2009 2009 2009 2009 2009 2009 2009 2009 \n|_____|\\___/ \\___/   /_/  2009 2009 2009 2009 2009 2009 2009 2009 \n-->",
		'passages': {
		},
	},
	'10 de enero de 2009': {
		'text': "<blockquote>\n<p>&quot;Tomando y amando me paso las noches<br>y me gana el llanto al amanecer.&quot;&quot;</p>\n</blockquote>\n<p>Hoy no pasó nada.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue20\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue20': {
		'text': "<p>Sentado en una silla metálica del Cinco Años Bar, Fran Baxter observaba su reino. Sobre la mesa había botellas de cerveza vacías, limones y un platito con cacahuates. No había clientes: eran las cinco de la mañana del miércoles y el último cliente había sido depositado cuidadosamente en un taxi hacía casi una hora. En la cantina sólo estaban él, Luis el cantinero, Pequita y Maricela las meseras y Goyito el mesero: lo más parecido a una familia que le quedaba a Fran Baxter el patrón, Fran Baxter el artista sonoro menos rentable del ejido, Fran Baxter nobody-not-anymore, Fran Baxter el productor musical fracasado, Fran Baxter la estrella del ring que se quedó sin máscara y sin cabellera.<br>En la rocola sonaban los Cardenales. Fran Baxter cantaba susurrando. “Tomando y amando me paso las noches”. De vez en cuando se levantaba al refri por otra cerveza.<br>—Ya van a cerrar, güey —le dijo una voz vagamente conocida. Levantó la mirada y se encontró con un rostro muy familiar: el suyo, tal cual como lo veía en el espejo.<br>Fran Baxter tenía mucho sin encontrarse con Otro Fran Baxter. No lo extrañaba.<br>—Aquí cierran cuando yo digo —contestó Fran Baxter. Otro Fran Baxter se le quedó mirando: &quot;¿Me vas a invitar a tomar una chela contigo o nel?&quot;. Fran Baxter lo miró sin molestarse en mover más que la mirada. Le dio un trago a la botella de Carta Blanca y le hizo una señal con los ojos a Otro Fran Baxter de que se sentara.<br>—Gracias —dijo Otro Fran Baxter quitándose el sombrero y poniéndolo sobre la mesa; se sentó y muy sonriente miró a su alrededor—. Todo un empresario. Quién te viera.<br>—No sé si todo esto cuente como ser empresario.<br>Fran Baxter se levantó al refrigerador por una cerveza para Otro Fran Baxter.<br>—Claro que sí cuenta —contestó Otro Fran Baxter—. Ese es tu problema, no piensas como persona normal, piensas como egresado de universidad extranjera.<br>—¿Vienes a reclamarme mi formación académica? ¿Nuestra formación académica?<br>Fran Baxter puso la cerveza sobre la mesa.<br>—No, para nada —contestó Otro Fran Baxter—. Gracias.\n—¿Tienes sotol?<br>Maricela no dijo nada y volteó a ver a Fran Baxter, quien asintió con la cabeza.<br>—Sí, señor —contestó la muchacha.<br>—Pues eso te pido —contestó Otro Fran Baxter sonriente.<br>—¿Algo para usted, señor? —le preguntó la mesera a Fran Baxter.<br>—Otra carta, Maricela, por favor.<br>—Enseguida —contestó la mesera y caminó hacia la barra.<br>—Qué guapa muchacha —dijo Otro Fran Baxter—, ¿no es menor de edad, verdad, cabrón? Te conozco. Pero bueno, ¿en qué estábamos?<br>—En que no soy una persona normal porque estudié en el extranjero.<br>—Ya, sí —contestó Otro Fran Baxter sacando un cigarro del bolsillo de su camisa vaquera—. ¿Tienes encendedor?\n—Ya no fumo.<br>—Lástima —dijo Otro Fran Baxter poniéndose el cigarro tras la oreja—, ahorita le pedimos uno a Maricelita. Pero bueno, te decía: Libertas Profundet Omnias Luce. Y si todavía lo dudas mira qué fino establecimiento tienes a tu nombre.<br>Maricela regresó con una carta para Fran Baxter y una botella de sotol y un caballito para Otro Fran Baxter. Abrió la botella de carta y luego le llenó el caballito a Otro Fran Baxter.<br>—Gracias, Maricela —dijo Otro Fran Baxter, olvidando que le iba a pedir un encendedor.<br>—Es un placer, señor —contestó ella.<br>Otro Fran Baxter levantó el caballito y lo miró a contraluz ante un foco amarillento sobre la pared. Lo olió, aspirando profundamente, de una forma casi obscena. Finalmente le dio un pequeño trago que saboreó durante unos segundos que a Fran Baxter, el &quot;original&quot;, le parecieron insoportables.<br>—Está feo tu sotol.<br>—¿A qué viniste, cabrón? —contestó Fran Baxter—. Ya no le des tantas pinches vueltas.<br>Otro Fran Baxter lo miró mientras saboreaba otro traguito del sotol. En la rocola cantaba don Cesáreo Sánchez.<br>Fran Baxter tenía años sin poner un pie en la antigua casona / estudio / centro de operaciones de Pakistán Records. Tenía años sin ir a Progreso, en donde estaba el ejido donde por alguna inescrutable razón se había construido esa casona estilo inglés a principios del siglo XX.<br>Durante años se creyó que el ejido Pakistán y esta casona se encontraban en el municipio de General Cepeda. Este rumor tiene su origen en algo que el mismo Fran Baxter escribió en uno de sus diarios, una selección de los cuales fueron publicados en formato electrónico a mediados de 2011 por un grupo de escritores saltillenses. No está claro por qué Fran Baxter haría este cambio radical en la ubicación del ejido Pakistán. La respuesta más sencilla es, muy probablemente, la correcta: Fran Baxter no quería que nadie supiera dónde estaban exactamente la vieja casona inglesa ni el ejido que le dió nombre a una de las disqueras más icónicas del desierto coahuilense.<br>—¿Y eso? —preguntó Fran Baxter. No había tomado de su cerveza, que descansaba sudorosa en una servilleta sobre la mesa.<br>—La verdad —dijo Otro Fran Baxter sin apartar la vista de su sotol—, estas alturas siento que es la única forma de que se te olvide todo lo que pasó. ¿No tienes jicaritas?<br>—¿Olvidar todo lo que pasó? —contestó Fran Baxter sin hacer caso a la pregunta de Otro Fran Baxter—. ¿Olvidar qué?<br>—Que fracasaste, pendejo. Que tus sueños de ser un productor valieron verga porque eres incapaz de trabajar con otras personas. Que te quedaste solo porque eres incapaz de ser amigo. ¿Querías que te lo dijera? Pues ahí está.<br>Fran Baxter le dio un trago a su cerveza.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue21\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue21': {
		'text': "<p>—Ahí les encargo el changarro —le dijo Fran Baxter a sus empleados.<br>—No se apure patrón —contestó Goyito—. Aunque déjeme decirle que yo sí me apuro: este tipo con el que se va no tiene buena pinta. Una corazonada, nomás.<br>—No te apures, me sé cuidar.<br>—A mí también me da miedo —dijo Maricela.<br>—No dije que me diera miedo —contestó Goyito.<br>—Tiene cara de malo —dijo Luis.<br>—Tiene cara de hijo de la chingada —agregó Pequitas.<br>—No se queden mucho más —dijo Fran Baxter; le dio el último trago a la carta blanca y puso la botella sobre la mesa—. Vayan a dormir un rato. ¿Subiste la yelera que te pedí, Goyito?<br>—Sí, patrón. La eché en la caja de la troca.<br>Porque Otro Fran Baxter traía mueble, claro: una Ford F-100 del cincuenta y córrele, blanca, cuidadísima. &quot;Muy bonita&quot;, pensó Fran Baxter, &quot;pero qué hueva la dirección mecánica”.<br>—¿Está con madre, verdad? —preguntó Otro Fran Baxter al ver que Fran Baxter recorría la F-100 con la mirada.\n—Muy —contestó Fran Baxter.<br>Otro Fran Baxter subió a la camioneta. Las puertas hacían un aparatoso y sonido metálico al abrir y cerrar, como si se estuviera quejando. Fran Baxter trató de abrir la puerta del copiloto pero tenía seguro. Otro Fran Baxter estiró el brazo y quitó el seguro.<br>—Súbase, compare.<br>—Gracias.<br>—¿Tienes hambre?<br>—Pues —Fran Baxter cerró la puerta. Kling, klang, la puerta parecía quejarse todavía unos segundos después de cerrarla. Todo en esa camioneta parecía pesado, torpe, fuerte. Esa camioneta le parecía a Fran Baxter una especie de dinosaurio herbívoro a punto de morir. Un brontosaurio senil. Un estegosaurio con la espalda chimuela. ¿Se quedaban chimuelos de la espalda los estegosaurios?<br>—Yo digo que no —dijo Otro Fran Baxter.<br>—¿No qué?<br>—Pues qué. Que no traes hambre, güey. Andas medio distraído.<br>—Estoy pensando en dinosaurios.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue22\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue22': {
		'text': "<p>—Esto parece final de fiesta —dijo Otro Fran Baxter—: ya no hay mucho qué quemar.<br>—Algo es algo —contestó Fran Baxter—. Además ya estamos aquí.<br>Llevaban un galón de gasolina en cada mano. Caminaron hacia las ruinas de la casa. El camino empedrado seguía ahí. Fran Baxter se sintió un poco mareado.<br>Las luces de la F-100 iluminaban el frente de la casa.<br>—¿Alguna vez has quemado una casa? —preguntó Otro Fran Baxter.<br>—No. ¿Y tú?<br>—Tampoco.<br>—No puede ser tan difícil.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue23\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue23': {
		'text': "<p>Los primeros rayos del sol iluminaban los güizaches cuando Fran Baxter caminó tambaleándose hacia la F-100. Había perdido de vista a Otro Fran Baxter. Cuando intentó regresarle el encendedor ya no estaba ahí.<br>El cielo era de un azul muy oscuro. El mundo era de un azul muy oscuro. La F-100 tenía las luces apagadas. “Pinche batería”, pensó Fran Baxter.<br>Abrió la puerta del conductor y puso sobre el asiento del copiloto la yelera llena de cerveza que estaba en la caja de la camioneta. Fran Baxter miró por última vez los restos de la casona de Pakistán Records. Sacó una lata de tecate de la yelera. Abrió la cerveza pero el llanto le impidió dar el primer trago.</p>",
		'passages': {
		},
	},
}
})();