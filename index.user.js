// ==UserScript==
// @name         KhanCrack
// @version      1.1.1
// @description  Parses requests for answer to questions
// @author       piman51277
// @match        https://www.khanacademy.org/*
// @grant        none
// @require https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js
// ==/UserScript==

(function () {
	'use strict';
	window.loaded = false;

	class Answer {
		constructor(answer, type) {
			this.body = answer || ["none"];
			this.type = type || "error";
		}

		get isMultiChoice() {
			return this.type == "multiple_choice";
		}

		get isFreeResponse() {
			return this.type == "free_response";
		}

		get isExpression() {
			return this.type == "expression";
		}

		get isDropdown() {
			return this.type == "dropdown";
		}

		get isError() {
			return this.type == "error";
		}

		log() {
			const answer = this.body;

			answer.map(ans => {
				if (typeof ans == "string") {
					if (ans.includes("web+graphie")) {
						this.body[this.body.indexOf(ans)] = "";
						this.printSVGImage(ans);
					}
					else if (/\!\[.+\]\(https:\/\/.+\.png\)/.test(ans)) {
						this.body[this.body.indexOf(ans)] = "";
						this.printPNGImage(ans);
					}
					else {
						if (/^\$.+\$$/.test(ans)) {
							const svgElement = MathJax.tex2svg(ans.replaceAll("$", "")).childNodes[0];
							var svgURL = new XMLSerializer().serializeToString(svgElement);
							var img = new Image();
							img.src = 'data:image/svg+xml; charset=utf8, ' + encodeURIComponent(svgURL);
							renderImage(img.src);
						}
						answer[answer.indexOf(ans)] = ans.replaceAll("$", "");

					}
				}
			});

			const text = answer.join("\n");
			if (!this.isError && text) {
				console.log(`%c${text.trim()} `, 'color:LawnGreen;');
			}
			else if (this.isError) {
				console.log(`%c Unable to find answer!`, 'color:Red;');
			}
		}

		printSVGImage(ans) {
			const url = ans.replace("![](web+graphie", "https").replace(")", "");
			const labelURL = `${url}-data.json`;
			renderSVG(url + ".svg", labelURL);
		}
		printPNGImage(ans) {
			const url = ans.replace(/\!\[.+\]\(/, "").replace(")", "");
			renderImage(url)
		}
	}

	async function renderSVG(url, labelURL) {
		const image = new Image();
		image.src = url;
		image.crossOrigin = "anonymous";
		image.onload = async function () {

			const labels = await (fetch(labelURL)
				.then(response => {
					if (!response.ok) {
						throw new Error("HTTP error " + response.status);
					}
					return response.text();
				})
				.then(raw => {
					return JSON.parse(raw.replace(/svgData[0-9a-f]+\(/, '').replace(/\)\;/, ''));
				}))

			const canvas = document.createElement("canvas");
			canvas.width = this.width;
			canvas.height = this.height;

			const ctx = canvas.getContext("2d");
			ctx.fillStyle = "white";
			ctx.fillRect(0, 0, this.width, this.height);
			ctx.drawImage(this, 0, 0);

			const [[minX, maxX], [minY, maxY]] = labels.range;
			const scaleX = canvas.width / (maxX - minX);
			const scaleY = canvas.height / (maxY - minY);

			ctx.fillStyle = "black";
			for (const label of labels.labels) {
				const { content, alignment, coordinates, style, typesetAsMath } = label;

				if (typesetAsMath) {
					ctx.font = "400 16.94px Times New Roman, serif"
				}else{
					ctx.font = "bold 700 14px Lato, sans-serif"
				}

				const { transform } = style;
				const [x, y] = coordinates;
				let realX = (x - minX) * scaleX
				let realY = canvas.height - ((y - minY) * scaleY)

				switch (alignment) {
					case "left":
						ctx.textAlign = "right";
						break;
					case "right":
						ctx.textAlign = "left";
						break;
					case "center":
						ctx.textAlign = "center";
						break;
					case "below":
						ctx.textAlign = "center";
						realY += 20;
						break;
				}

				if (transform && transform.includes('rotate')) {
					ctx.save();
					const degrees = transform.replace('rotate(', '').replace('deg)', '');
					ctx.translate(realX, realY);
					ctx.rotate(degrees * Math.PI / 180);
					ctx.fillText(content, 0, 0);
					ctx.restore();
				} else {
					ctx.fillText(content, realX, realY);
				}


			}

			const dataURL = canvas.toDataURL("image/png");
			const imageStyle = [
				`font-size: 0px;`,
				`padding: ${this.height * .5}px ${this.width * .5}px;`,
				'background:url("', dataURL, '")'
			].join(' ');
			console.log('%c ', imageStyle);
		}
	}
	function renderImage(url) {
		const image = new Image();
		image.src = url;
		image.crossOrigin = "anonymous";
		image.onload = function () {

			const canvas = document.createElement("canvas");
			canvas.width = this.width + 10;
			canvas.height = this.height + 10;

			const ctx = canvas.getContext("2d");
			ctx.fillStyle = "white";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(this, 5, 5);

			const dataURL = canvas.toDataURL("image/png");
			const imageStyle = [
				`font-size: 0px;`,
				`padding: ${canvas.height * .5}px ${canvas.width * .5}px;`,
				'background:url("', dataURL, '")'
			].join(' ');
			console.log('%c ', imageStyle);
		}
	}

	const originalFetch = window.fetch;
	window.fetch = function () {
		return originalFetch.apply(this, arguments).then((res) => {
			if (res.url.includes("/getAssessmentItem")) {
				const clone = res.clone();
				clone.json().then(json => {
					let item, question;

					try {
						item = json.data.assessmentItem.item.itemData;
						question = JSON.parse(item).question;
					} catch {
						let errorIteration = () => { return localStorage.getItem("error_iter") || 0; }
						localStorage.setItem("error_iter", errorIteration() + 1);

						if (errorIteration() < 4) {
							return location.reload();
						} else {
							return console.log("%c An error occurred", "color: red; font-weight: bolder; font-size: 20px;");
						}
					}

					if (!question) return;

					console.log("Question:\n", question.content);
					console.log("Answer(s):")
					Object.keys(question.widgets).map(widgetName => {
						if (question.content.includes(widgetName)) {
							switch (widgetName.split(" ")[0]) {
								case "input-number":
									return numericAnswerFrom(question, widgetName).log();
								case "numeric-input":
									return freeResponseAnswerFrom(question, widgetName).log();
								case "radio":
									return multipleChoiceAnswerFrom(question, widgetName).log();
								case "expression":
									return expressionAnswerFrom(question, widgetName).log();
								case "dropdown":
									return dropdownAnswerFrom(question, widgetName).log();
								case "explanation":
									return;
								default:
									return console.log("%c Unable to find answer!", "color:red;");
							}
						}
					});
				});
			}

			if (!window.loaded) {
				console.clear();
				console.log("%c KhanCrack", "color: LawnGreen; font-size:35px;font-family:monospace;");
				console.log("%c v1.1.1", "color: white; -webkit-text-stroke: .5px black; font-size:15px; font-weight:bold;");
				window.loaded = true;
			}

			return res;
		})
	}

	function numericAnswerFrom(question, widgetName) {
		const widget = question.widgets[widgetName];
		if (widget.options?.value !== undefined) {
			return new Answer([widget.options.value], "free_response");
		}
		return new Answer();
	}

	function freeResponseAnswerFrom(question, widgetName) {
		const widget = question.widgets[widgetName];
		if (widget.options?.answers !== undefined) {
			return new Answer(widget.options.answers.map(answer => {
				if (answer.status == "correct") {
					return answer.value
				}
			}).filter((val) => { return val !== undefined; }), "free_response");
		}
		return new Answer();
	}

	function multipleChoiceAnswerFrom(question, widgetName) {
		const widget = question.widgets[widgetName];
		if (widget.options?.choices !== undefined) {
			return new Answer(widget.options.choices.map((choice) => {
				if (choice.correct) {
					return choice.content
				}
			}).filter((val) => { return val !== undefined; }), "multiple_choice");
		}
		return new Answer();
	}

	function expressionAnswerFrom(question, widgetName) {
		const widget = question.widgets[widgetName];
		if (widget.options?.answerForms !== undefined) {
			return new Answer(widget.options.answerForms.map(answer => {
				if (Object.values(answer).includes("correct")) {
					return answer.value
				}
			}).filter((val) => { return val !== undefined; }), "expression");
		}
		return new Answer();
	}

	function dropdownAnswerFrom(question, widgetName) {
		const widget = question.widgets[widgetName];
		if (widget.options?.choices !== undefined) {
			return new Answer(widget.options.choices.map((choice) => {
				if (choice.correct) {
					return choice.content
				}
			}).filter((val) => { return val !== undefined; }), "dropdown");
		}
		return new Answer();
	}
})();
