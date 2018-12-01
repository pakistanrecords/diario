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


squiffy.story.start = '3 y 4 de noviembre de 1996';
squiffy.story.id = '618dd59eb5';
squiffy.story.sections = {
	'_default': {
		'text': "<!--\n\n# EL DIARIO DE FRAN BAXTER\n\nIFID: 6407CD62-DD53-4F44-836E-F47A0A8E7204\n\n-->",
		'passages': {
		},
	},
	'ddfb': {
		'text': "<h1 id=\"el-diario-de-fran-baxter\">El diario de Fran Baxter</h1>",
		'passages': {
		},
	},
	'3 y 4 de noviembre de 1996': {
		'text': "<h2 id=\"3-y-4-de-noviembre-de-1996-un-dos-tres-por-m-y-por-todos-mis-amigos\">3 y 4 de noviembre de 1996: Un dos tres por mí y por todos mis amigos</h2>\n<p>—Sonríe a la cámara —dice Alejandra Casandra. Trae puesta mi camisa favorita, la black and white de franela. Yo: {rotate:camisa polo, jodidona:pantalón de pana, beige:adidas, enough said:sombrero, vaquero}. Me está grabando con su Betamax. Camino hacia {rotate:la cámara:Alejandra} con una cerveza en cada mano, me abro paso a través de los asistentes a una fiesta en la que me encuentro {rotate:contra toda probabilidad:against my better judgement}.<br>En el sonido que le rentamos al Maza suena una cinta: Los Tigres del Norte. Trato de bailar, seguro me veo ridículo pero no me importa y le alcanzo una cerveza a {rotate:Alejandra:la cámara:mai lob}.<br>—Gracias —dice. Pone su cámara sobre mesa en la que había desplegado su escaparate de fanzines y agarró la cerveza. Poso mi mano suavemente en la curva de su cintura y veo los fanzines, fotocopias en blanco y negro, portadas impresas en papel bond de colores, hechas a mano, máquina, tijera y pegamento. A nadie en la fiesta parecen importarle los fanzines de Alejandra y los odio a todos un poco por es. Alejandra se ríe de algo.<br>Un grupo de juniors cantan al lado de un asador lleno de carne: {rotate:&quot;juventudes del partido&quot;:“ganado sin garrapatas que llevo pal extranjero”, entonan, felices}. Pakistán Records está a punto de debutar en sociedad durante la fiesta de &quot;cierre de campaña&quot; que el candidato regala a &quot;las juventudes del partido”.<br>—Ya casi me tengo que ir —digo.<br>—¿A Piedras? —pregunta Alejandra.<br>—Sí —contesto y le doy un trago a la cerveza—. Tengo que ir por Pancho y Mubarak.<br>—¿<a class=\"squiffy-link link-passage\" data-passage=\"Y Las Bulbas\" role=\"link\" tabindex=\"0\">Y Las Bulbas</a>? —pregunta Alejandra.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue1\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'Y Las Bulbas': {
				'text': "<h1 id=\"las-bulbas-i-\">Las Bulbas (I)</h1>\n<h2 id=\"10-de-mayo-de-1995\">10 de mayo de 1995</h2>\n<p>Cherry encontró un teléfono público en un sitio de taxis, afuera de una cantina con un nombre fabuloso: el Bar Corea del Sur, ahí cruzando la calle de la central de autobuses. Se protegía de la lluvia bajo el techo del sitio mientras buscaba en su mochila el papel donde había apuntado el número de teléfono de Freddy.<br>No chingues, dónde lo dejé. Debe estar por aquí.<br>Entre todos sus fanzines y materiales para hacerlos: hojas, lápices, plumas, marcadores, tijeras, pegamento, un par de revistas <em>para chavas</em> y tú, ¿quién eres?<br>Lodi estaba en la central de autobuses cuidando las maletas y Beto, el hermano de Cherry, había ido a una taquería a media cuadra de ahí para comprar algo de cenar.<br>No encontraba el número de teléfono.<br>Una moto pasó hecha la madre.<br>Qué pedo con ese güey.</p>",
			},
		},
	},
	'_continue1': {
		'text': "<p>Moncho Zen Ando y Larissa Double Coil, i.e. Los Turistas de Calcetín Blanco, regresan con caballitos y aliento alcohólico, ambos vestidos como si fueran a salir en la cabalgata. Larissa, sonriente, carga una botella de Morgan como si fuera un bebé pequeño.<br>—¿Cómo ves mi, Fran? —pregunta Moncho, cagado de la risa—: pa pasar desapercibidos.<br>—Falta la redshirt, cabrón.<br>—Guárdame una de cada una —dice Larissa. Señala los fanzines de Alejandra con el caballito. Trae un sombrero mexicano impresionante.<br>—A huevo, doctora.<br>—Aquí ya no soy doctora, guapa.<br>—No mames —me sobresalto—, vieras cómo le cagaba que le dijeran doctora back in Barcelona.<br>—En una tocada, —carcajea Moncho—, esta pendeja, se andaba agarrando a madrazos con una morra porque le gritó doctora.<br>—Ah —Larissa, indignada—: seas mamón. Ella empezó.<br>Risas.<br>—Larissa, entonces —dice Alejandra luego de un breve silencio.<br>Larissa.<br>—Oye, Fran —dice Moncho, caballito en mano—. Parece que te anda buscando este güey, ¿cómo se llama? El de la casa.<br>—Lucio.<br>—Ese puñetas —bebe de su tequila—. Te anda buscando y se ve preocupado.<br>—Gracias —contesto.<br>—De Nancy.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue2\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue2': {
		'text': "<p>Fran Baxter <a class=\"squiffy-link link-passage\" data-passage=\"cruza el patio hasta la casa\" role=\"link\" tabindex=\"0\">cruza el patio hasta la casa</a>. Larissa y Moncho le empiezan a hacer plática a Alejandra Casandra.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue3\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'cruza el patio hasta la casa': {
				'text': "<p>No sé de quién es esta casa. Este sillón es muy elegante, siento que lo voy a ensuciar nomás de verlo y estoy sentado en él desde hace como quince minutos. Seguro lo que cuesta este sillón nos paga los honorarios y el hospedaje y las comidas y el alcohol y las drogas que no son alcohol durante toda la semana. Bueno, no sé si el sillón, pero sí la salita completa. Si le agregamos el leiziboi donde está sentado Lucio pues igual y una semana más. Los libros de arte, los cofiteibol, pagan varias carnes asadas, ¡son Taschen! Se alcanzan a escuchar las cumbias del Maza pero <em>sobre todo</em> se escucha a Fela Kuti &amp; Africa 70 en el piso de arriba. Quién viera a las juventudes priístas, tan eclécticas en sus sensibilidades, no me lo habría imaginado jamás. Ya estoy muy al borde del sillón. Fela Kuti no ayuda, pero para nada. No mames, qué pinche serie de equivocaciones tan pendejas me trajeron hasta aquí.<br>—Perdón, Fran —dice Paulina, {sequence:una morra de sabinas:la hija de un empresario local:una lideresa one percent principiante:la novia de Lucio:mi exnovia:la organizadora del evento}—. Ojalá firmen mañana los coordinadores y te pagamos en la semana siguiente.<br>Juventudes del partido {rotate:entran y salen:salen y entran} de la casa. Si algo tienen en común todos es que no entienden que cuando uno dice &quot;no tengo dinero&quot; significa &quot;no tengo un puto peso&quot;. Para ellos, no tener dinero es no poder ir a San Antonio esta semana, váyanse a la verga.<br>—Aliviánate, carnal —dice Lucio. Neorrositense, hijo de doctor, dueño de la casa, novio de Paulina, el encargado de las finanzas de Juventudes Partidistas, S.A. de C.V., donde todos llevamos puesta la playera, literal y metafórica, del candidato priísta. No hay un átomo agradable en este güey.<br>&quot;Supongo que hay que vencerlos desde adentro&quot;, dijo Bobo Lafragua hoy en la mañana que hablamos por teléfono. &quot;Ponte la pinche playera&quot;, agregó; y colgó.<br>—Bueno: tengo una tocada que coordinar y todavía tengo que ir a recoger a unos jomis. Ya me están esperando, de hecho.<br>Me levanto del sillón.<br>—Unos... ¿<em>jomis</em>, Fran?<br>—Sí.<br>—Wey. Te he visto llorar porque te echaron tierra en el receso. Nadie te cree esa pinche pose de wey de barrio, mamón.<br>—Teníamos como seis años.<br>—Teníamos catorce. Nos conocimos en la secundaria.<br>—Ya me voy, Paulina. Bai, Lucio. Me carga la verga.<br>—Pero llegas a tiempo, ¿verdad? Viene el candidato y tú no me vas a hacer quedar mal, cabrón.<br>—Me vale verga tu pinche candidato —pensé, pero no dije. Más bien contesté algo así como<br>—OK, Paulina.<br>y me fui.</p>",
			},
		},
	},
	'_continue3': {
		'text': "<p>Había un fantasma pidiendo rai camino a Piedras Negras. No le hice caso: ahorita no hay tiempo para esas indulgencias.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue4\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue4': {
		'text': "<p>Los Nebulosos Darwins, i.e. Pancho Taylor y Mubarak Saavedra, han estado tocando en este apestoso cantabar jaguayano los últimos cinco meses, casi a diario. Lo hacen a cambio de un par de cervezas y un pago semanal que apenas cubre el departamento que están rentando a unos metros del puente internacional. Acaban de tocar un popurrí acústico de Creedence. El cantabar está casi solo y una persona aplaude desde {rotate:un oscuro rincón del bar:su borrachera imaginaria}.<br>Se echan un par de rolas más. <a class=\"squiffy-link link-passage\" data-passage=\"Mubarak canta\" role=\"link\" tabindex=\"0\">Mubarak canta</a> mientras <a class=\"squiffy-link link-passage\" data-passage=\"Pancho toca su guitarra\" role=\"link\" tabindex=\"0\">Pancho toca su guitarra</a>. Muy distinto a lo que regularmente hacen.<br>Have you ever seen the rain?<br>Los Nebulosos terminaron su número alrededor de las nueve y media pe eme, para nada el horario estelar. Echan sus cosas en una samsonait madreadísima. Caminan a la barra y el cantinero los recibe con dos fantas.<br>Me acoerco a la barra y me siento junto a Mubarak. Dibuja mandalas en una servilleta con el sudor de la fanta.<br>—Buenas noches, caballeros —saludo. Los Nebulosos voltean a verme al mismo tiempo.<br>—Buenas —contesta Mubarak. Pancho sólo alza un poco su fanta.<br>—¿Los Nebulosos?<br>—En persona —dijo Mubarak.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue5\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'Mubarak canta': {
				'text': "<h1 id=\"mubarak-saavedra-i-\">Mubarak Saavedra (I)</h1>\n<blockquote>\n<p>If I only had a dollar<br>For every song I´ve sung<br>And every time I had to play<br>While people sat there drunk.</p>\n</blockquote>\n<p>Mubarak era hijo de franquistas, así que su carrera empezó en una banda de punk cuando tenía unos quince años. Y resultó que sus papás tenían razón: el punk no lo llevó a nada bueno.<br>Poco antes de cumplir los dieciocho emigró a México donde fue parte de un inusitado interés en la música con vagos tintes flamencos. El interés en lo español por lo español era tal que Mubarak Saavedra fue parte de varias agrupaciones de neo-flamenco aún sin haber cantado otra cosa que jarcor panc en toda su vida.<br>Fue durante una de sus aventuras de cybercantaor que Mubarak Saavedra decidió fumar sapo por consejo de la anciana a la que le compraba tortillas sobaqueras en Hermosillo. Al día siguiente renunció a las palmas y cante y escribió &quot;Malakatonche&#39;s World Parade&quot;, una {rotate:suite poética:ópera rock} que grabaría unos años después.<br>Pero primero debía, desde luego, peregrinar a Acapulco.</p>",
			},
			'Pancho toca su guitarra': {
				'text': "<h1 id=\"pancho-taylor-i-\">Pancho Taylor (I)</h1>\n<blockquote>\n<p>The moon just went behind the clouds\nTo hide it&#39;s face and cry</p>\n</blockquote>\n<p>Guitarrista de gustos sencillos, Pancho toca una Telecaster conectada a un overdraiv y un dilei.<br>Hijo de una tercera generación de fara faras y cumbiamberos de Tijuana, desde pequeño visitó los burdeles de Tijuana, si bien los más decentes y de buena reputación. Fue en uno de esos burdeles que el adolescente Francisco perdió su virginidad con una maravillosa jovencita conocida como Geraldine.<br>—Tú puedes decirme Claudia —le suspiraba ella al oído bajo la luz de la luna.<br>—Claaaaaudia —bromeaba él. Ella reía.<br>—¡No me asustes!<br>Al menos eso cuenta {rotate:una novela:autobiografía:una novela que se hace pasar por autobiografía:una autobiografía que se hace pasar por una novela} publicaada por el instituto de cultura del estado a principios de los noventa. El título del libro es sensacional: <em>La maroma rodante: anales de rock vaquero</em>. ¡Chingas! Debería leerlo.<br>Es curioso porque cuando uno lo conoce uno pensaría que por sus venas no corre ni el rock: es una especie de vampiro motorizado, mitad gótico norteño y mitad ángel del infierno, a medio camino entre la carroza fúnebre y la jarli.</p>",
			},
		},
	},
	'_continue5': {
		'text': "<p><img src=\"images/IMG_1642.JPG\"></p>\n<p>—Soy Fran Baxter —&quot;y me siento ridículo&quot;, pensé—: <a class=\"squiffy-link link-passage\" data-passage=\"el productor\" role=\"link\" tabindex=\"0\">el productor</a><br>—Ay, de veras, ¿qué fue eso? —escuché y una mano enorme me hizo a un lado. Es Ulises, el dueño del cantabar, un fisicoculturista calvo de un metro noventa vestido como padrote de rancho.<br>—¿Qué onda, Ulises? —pregunto.<br>—¿Qué onda, Fran? —pregunta Ulises, sin esperar una respuesta, y agrega—¿En serio no pueden tocar algo que le guste a la gente?<br>—A mí me gustó, Ulises —salgo en defensa de Los Nebulosos.<br>—Ay, Fran —Ulises, sonrisa falsa—, cállate.<br>—¿Como qué, Ulises? —pregunta Pancho.<br>—No sé, cabrón —dice Ulises; empieza a caminar hacia la barra—. Una canción de protesta o una balada romántica. Yo qué sé. Ustedes son los músicos. Pero pinche Creedence nadie sabe cantarlas, están en inglés.<br>—Y estamos en la frontera —digo, sordeado.<br>—Cállate, Fran.<br>—Eso no es lo que hacemos —dice Pancho.<br>—Pues háganlo. Pero en fin. Dice Sandino que le ayuden a conectar su guitarra y sus pedales. Sirvan de algo.<br>—Yo le ayudo a Sandino a instalarse —salgo huyendo—. Usted siga negociando la estética de su establecimiento con sus empleados.<br>—No somos sus empleados —dice Pancho.<br>—Y mi estética no está abierta a negociaciones —agrega Ulises y camina de vuelta a la cocina.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue6\" role=\"link\" tabindex=\"0\">%%%</a></p>",
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
	'_continue6': {
		'text': "<p>La ventanilla del copiloto tiene una hoja de papel continuo con la impresión &quot;PAKISVÁN&quot;. Se está despegando la cinta adhesiva que sostiene una de sus esquinas. Mubarak trata de volver a ponerla en su lugar, sin éxito.<br>—La tocada es aquí en corto —digo mientras nos subimos a la Pakisván—. Como les digo, todavía no hay mucho varo pero vamos a hacer cosas interesantes. El lineup de la disquera está bien interesante, ya verán. Lo que queremos armar no lo tiene nadie.<br>—¿Y qué quieren armar exactamente?<br>—Música monster.<br>Silencio.<br><a class=\"squiffy-link link-passage\" data-passage=\"Al volante de la Pakisván\" role=\"link\" tabindex=\"0\">Al volante de la Pakisván</a> y con Los Nebulosos Darwins de cargamento, agarré la 57 por ahí de las diez.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue7\" role=\"link\" tabindex=\"0\">%%%</a></p>",
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
	'_continue7': {
		'text': "<p>No debí haber fumado. {rotate:No tanto:No en la Rosita-Piedras, en la Pakisván, arriba de los cien kilómetros por hora, no:No}. Los Nebulosos <a class=\"squiffy-link link-passage\" data-passage=\"pusieron su demo en el estéreo de la Pakisván\" role=\"link\" tabindex=\"0\">pusieron su demo en el estéreo de la Pakisván</a>. Ya quiero producirlos.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue8\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'pusieron su demo en el estéreo de la Pakisván': {
				'text': "<p>Los Nebulosos Darwins, &quot;Mars Station&quot;, en el demo <em>mlktnch3</em> de 1995.  </p>\n<audio src=\"music/mars.mp3\" autoplay controls>",
			},
		},
	},
	'_continue8': {
		'text': "<p>—¿Y dónde es la tocada? —pregunta pancho desde el sillón que traemos en la Pakisván.<br>—En una villa de Sabinas —explico—. La casa de un junior local. Si todo sale bien estos chavos van a conseguirnos tocadas en otras partes a lo largo de la semana. Igual y hasta más.<br>—¿Y si no todo sale bien? —pregunta Pancho.<br>—Nos vamos al ejido a grabar.<br>—¿El ejido?<br>Les cuento un poco sobre la historia de Pakistán Records: la fundación de la disquera, Bobo Lafragua, la casona inglesa, los terrenos ejidales, la mutilación de ganado, Alejandra Casandra, los chamanes ejidatarios, el Magno Concurso Interranchonal de Elaboración de Sotol Artesano “Yo ya me voy a morir”, nuestros estudios amateurs de criptozoología coahuilense, Sandro de Amecameca, don Tito y El Vikingo, El Gran Asalto al Museo Pape, Los Turistas de Calcetín Blanco, etc. Ya se terminó el demo nebuloso. Están cabrones.<br>Mubarak guarda el caset{sequence:, Pancho sintoniza el fantasma de una difusora lejana:</p>\n<blockquote>\n<p>&quot;Sobre el piso de la Pakisván estaban regados los flyers de la fiesta de juniors. Fran Baxter las había impreso pensando que se trataría de un evento público.<br>Según la información del flyer la fiesta debería haber empezado dos horas antes de que Fran Baxter llegara a Piedras Negras.<br>Ahí en el flyer, entre otros nombres tan insólitos como Cáspita y Los Atónitos, Sandro de Amecameca, Los Turistas de Calcetín Blanco y Las Bulbas, estábamos nosotros, Los Nebulosos Darwins, dueto de voz y guitarra que en unas semanas empezaría a grabar su primer LP de calidad profesional\n} y suenan Carlos y José.<br>—¿Qué ciudad es esa?<br>—Sabinas.<br>—Parecen rascacielos.<br>—Sí.<br>Pancho se levanta para ver las luces de la ciudad en el horizonte.<br>—Es cierto —dice y vuelve a acostarse en el sillón.<br>Pasamos Nueva Rosita. No entramos pero les cuento de las hamburguesas al carbón que están <a class=\"squiffy-link link-passage\" data-passage=\"frente a la Fortunato\" role=\"link\" tabindex=\"0\">frente a la Fortunato</a>.<br>—¿No se supone que Los Nebulosos Darwins son una banda como de siete cabrones?<br>—Éramos —dice Mubarak—. Hemos tenido rotación de personal.<br>—En el demo ya nomás somos este cabrón y yo haciendo todo.<br>Las casas de madera parecen derrumbarse.</p>\n</blockquote>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue9\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'frente a la Fortunato': {
				'text': "<blockquote>\n<p>&quot;Yo no sabía qué era &#39;la fortunato&#39;.&quot;</p>\n</blockquote>",
			},
		},
	},
	'_continue9': {
		'text': "<p><a class=\"squiffy-link link-passage\" data-passage=\"El camino de regreso está lleno de fantasmas\" role=\"link\" tabindex=\"0\">El camino de regreso está lleno de fantasmas</a>.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue10\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'El camino de regreso está lleno de fantasmas': {
				'text': "<p><a href=\"https://write.as/0ahir1vem3mlb24o.md\">Apéndice I: Fragmentos, 1999</a>.</p>",
			},
		},
	},
	'_continue10': {
		'text': "<p>Ya llegamos a Sabinas. Pasa, un poco, de la medianoche. De paseo de los liones salimos al libramiento, mano derecha en el estadio, vuelta en el gimnasio como yendo al río y donde topa, por ahí, hay casas y villas muy elegantes. {rotate:La casa de Lucio está rodeada por un alto muro de piedra pintado de negro:  </p>\n<blockquote>\n<p>&quot;Quince años después esas casas pasarían una silenciosa noche bajo el agua&quot;</p>\n</blockquote>\n<p>}. Hay unos quince carros estacionados afuera, últimos modelos con calcomanías {secuence:del logo del partido:del rostro sonriente y redondo del candidato:del eslogan de la campaña}.<br>Se escucharía el melancólico y milenario rumor del río Sabinas si el Maza no fuera un genio: &quot;Falsa Traición&quot; sonaba desde varias cuadras antes de llegar.<br>Me estacioné detrás de la combi de Larissa, considerablemente más cuidada y amada que la mía.<br>—La Turisván —señalo—. Ahí viajan Los Turistas de Calcetín Blanco.<br>—Me laten esos güeyes —dice Mubarak—, no sé qué piense aquí mi compañero.<br>—Son buenos.<br>—A veces se la prestan a Las Bulbas.<br>—Hace poco nos rolaron un caset de esas morras, muy chingón.<br>—Nebuván me suena a medicamento controlado. Mola.<br>—También van a tocar ahorita, ¿verdad?<br>—Sí. ¿Conocen a Sandro de Amecameca?<br>—No.<br>—No.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue11\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue11': {
		'text': "<p>El olor de la carne asada es erótico y un muro con botellas de coca rotas protege a los inocentes habitantes de esta villa de los inmencionables peligros del mundo exterior.<br>Todos están pedísimos. Llego buscando la mirada a Alejandra y no la veo, a lo mejor se fue al baño. Saludan al Maza, sonidero. Don Tito y Primero Vallezar ya sacaron los de caña. Segundo Vallezar está dormido en una mecedora con una tecate en los güevos. Redshirts por todas partes. &quot;5 de té&quot;, La Rebelión de Teo Sánchez. ¿Dónde está Alejandra?<br>Los Pakistán se reunieron en la barra. Todo parece estarse llevando en relativa tranquilidad. Cierro los ojos. Los abro. Estoy muy pacheco, I can&#39;t fucking do this.<br>&quot;PAQUISTÁN (sic) RECORDS&quot;. Alguien usó un marcador permanente para agregar el &quot;(sic)&quot; en la lona impresa.<br>Sandro está gritando. Su asistente parece asustado. {rotate:Un redshirt:&quot;Oye, tu raza se está poniendo pesada&quot;}. Alejandra, ya la encontré, está saliendo de la casa. Me sonríe y me saluda. La siguen Los Turistas. Moncho voltea a verme y me saluda con un movimiento de cabeza. Trae la punta de la nariz manchada de blanco. Larissa está bebiendo de <a class=\"squiffy-link link-passage\" data-passage=\"la botella de Morgan\" role=\"link\" tabindex=\"0\">la botella de Morgan</a>.<br>—Ustedes abren, perros.<br>—No mames —Los Nebulosos a coro.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue12\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'la botella de Morgan': {
				'text': "<h2 id=\"sandro-s-shades-i-\">Sandro&#39;s Shades (I)</h2>\n<p>—Pregúntale a este gringo cara de meco que qué pedo con esas pinches mamadas que están ahí colgadas —dijo el hombre del sombrero tejano, lentes de Poncharelo, traje de vestir alguna vez blanco hoy más bien aperlado y botas de piel de avestruz: Sandro de Amecameca. Hablaba con su asistente, un hombre calvo y diminuto cuyo nombre nadie sabía: su patrón nunca se dirigía a él por su nombre.<br>El Vikingo cuidaba de los fanzines de Alejandra, quien ya se había instalado cómodamente en la barra y no parecía tener intenciones de moverse en un rato. El asistente de Sandro tosió suavemente para exigir la atención del Vikingo y dijo, ignorando y pasando por alto que El Vikingo no hablaba ni madres de español pero entendía a la perfección el dialecto rústico del norte profundo mexicano:<br>—Mr. Sandro would like me to inquire you regarding the nature of the venue’s decoration —dijo, señalando las llantas de yip, ruedas de carreta y calaveras de res que colgaban sobre la pared detrás del escenario.<br>—Los cráneos están vergas pero esas llantas y ruedas están de la verga.<br>—Mr. Sandro fancies the skulls but finds the wheels unsavory.<br>El Vikingo no contestó porque no tenía una respuesta. “Jesus fucking Christ”, pensó. Miró hacia el otro extremo del patio, donde los muchachos priístas estaban poniendo una canción de moda en la grabadora. Don Tito platicaba con el Dueto Valle Zar junto al asador. Ellos tres eran los únicos que habían comprado carne para asar durante la fiesta.  </p>",
			},
		},
	},
	'_continue12': {
		'text': "<p>—<a class=\"squiffy-link link-passage\" data-passage=\"Van ustedes y luego Sandro\" role=\"link\" tabindex=\"0\">Van ustedes y luego Sandro</a>, ¿está bien si tocan con él? Nomás por hoy, su banda tuvo un problema. Están de pedo sus pinches rolas. Puro círculo, los acompaño en la acústica para que me vean.<br>—Va —dice Pancho.<br>—Este güey es el Mazapán —dijo Fran Baxter señalando a un güero rechoncho y sonriente—. Es el del sonido. El que les conté que tiene un grupo.<br>Thumbs up del sonriente Mazapán.<br>—Quiúboles —contesta Pancho.<br>—¿Qué onda? —saluda Mubarak.<br>El Mazapán empieza a repartir amplis y micrófonos. Ya era hora de que la máquina de Pakistán Records empieza a hacer ruidos.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue13\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'Van ustedes y luego Sandro': {
				'text': "<h2 id=\"sandro-s-shades-ii-\">Sandro&#39;s Shades (II)</h2>\n<p>—¿Qué chingados son estas mamadas? —preguntó Sandro echándole un vistazo a los fanzines de Alejandra.<br>—Sandro de Amecameca would love to know more about these publications, good sir.<br>—¿Y dónde vergas están los pinches músicos que les encargué? —preguntó Sandro—. Seguro van a traer a cualquier pendejo al que mis canciones se la van a meter doblada.<br>—Mr. Sandro is worried about the absence and slash or technical capabilities of the backing band he politely required from you in his contract.<br>—They should arrive any moment now —contestó el Vikingo—. Don’t worry, Mr. Sandro, no preocupado, todo OK, todo OK.<br>Sandro de Amecameca parecía mirar fijamente a El Vikingo desde un lugar más allá de la oscuridad de sus lentes de poncharelo.<br>—Quiero una pinche chela —dijo Sandro.<br>—Mr. Sandro is feeling thirsty —tradujo su asistente.<br>El Vikingo les propuso, en perfecto inglés del sur de Texas, que fueran por una chela. Supuso que nadie se robaría los fanzines de Alejandra y no habría problema si los descuidaba un rato.<br>Caminaron hacia la barra donde un muy joven barman vestido con chamarra del SNTE preparaba martinis y mojitos mientras que un gordo enfundado en una members onli gris destapaba cervezas nacionales e internacionales para un grupo de juniors priístas.  </p>",
			},
		},
	},
	'_continue13': {
		'text': "<p>Chelas.<br>—Les voy a traer unas chelas. ¿Quieres una, Mazapán?<br>—Al rato. Orita pura agua.<br>Camino hacia {rotate:la barra:Alejandra}.<br>—¿Hey, cómo te fue?<br>—Todo bien. <a class=\"squiffy-link link-passage\" data-passage=\"Ya se van a conectar\" role=\"link\" tabindex=\"0\">Ya se van a conectar</a>.<br>Me abraza. La rodeo con mi brazo.<br>—¿<a class=\"squiffy-link link-passage\" data-passage=\"Vendiste fanzines\" role=\"link\" tabindex=\"0\">Vendiste fanzines</a>?<br>—No. Pero está bien, prefiero vendérselos a alguien que los va a leer.  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue14\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
			'Ya se van a conectar': {
				'text': "<p>Pancho tocaba así:</p>\n<p>Fender Telecaster -&gt; DS-1 -&gt; Cry Baby -&gt; DM-2 -&gt; Ampli</p>",
			},
			'Vendiste fanzines': {
				'text': "<h2 id=\"sandro-s-shades-iii-\">Sandro&#39;s Shades (III)</h2>\n<p>—¿Descuidando el bisnes, mai lirol Vaikin? —preguntó Alejandra.<br>—I don’t think nobody is gonna to steal your zines, Ale.<br>—Nah, yo tampoco.<br>—¿Qué le sirvo a los señores? —preguntó el de la members onli.<br>—Tecate Light —contestó Sandro.<br>—Carta Blanca —pidió El Vikingo.<br>—No —dijo Sandro—: mejor una cuba.<br>—Una limonada sin hielos —dijo el asistente.<br>—Pari jard, ¿eh? —dijo Alejanda dándole un codazo al asistente quien respondió con una tímida sonrisa.</p>",
			},
		},
	},
	'_continue14': {
		'text': "<p>Empiezan a sonar {rotate:Los Nebulosos:Los Reyes Locos}.<br>Esta barra se parece a la del cantabar.<br>El Mazapán tras los controles. Los Nebulosos en listos. Thumbs up. Thumbs up.<br>Este es un ritmo suave pa&#39; bailar, suave pa&#39; ba...  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue15\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue15': {
		'text': "<p>Silencio y gente hablando a gritos en medio del silencio y el melancólico y milenario rumor del Río Sabinas.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue16\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue16': {
		'text': "<p>—Guess who&#39;s coming, guess who&#39;s coming! —exclamó Mubarak al micrófono.<br>—¿Empezamos con ”El Río”? —preguntó Pancho.<br>—“El Río” —confirmó Mubarak. Tomó el micrófono con ambas manos.<br>—{sequence:One...:Two...:Three...:¡Chinguen a su madre los del PRI!}  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue17\" role=\"link\" tabindex=\"0\">%%%</a></p>",
		'passages': {
		},
	},
	'_continue17': {
		'text': "<!--\n ____   ___   ___   ___  \n|___ \\ / _ \\ / _ \\ / _ \\  2009 2009 2009 2009 2009 2009 2009 2009 \n  __) | | | | | | | (_) | 2009 2009 2009 2009 2009 2009 2009 2009 \n / __/| |_| | |_| |\\__, | 2009 2009 2009 2009 2009 2009 2009 2009 \n|_____|\\___/ \\___/   /_/  2009 2009 2009 2009 2009 2009 2009 2009 \n-->\n<h2 id=\"10-de-enero-de-2009-a-href-https-write-as-58xxnv0l43v81yfo-md-tomando-y-amando-me-paso-las-noches-a-\">10 de enero de 2009: <a href=\"https://write.as/58xxnv0l43v81yfo.md\">Tomando y amando me paso las noches...</a></h2>",
		'passages': {
		},
	},
}
})();