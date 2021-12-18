// ==UserScript==
// @name         KhanCrack
// @version      1.1.0
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
			this.body = answer;
			this.type = type;
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
							const canvas = document.createElement("canvas");
							const ctx = canvas.getContext("2d");
							img.onload = function () {
								canvas.width = this.width + 10;
								canvas.height = this.height + 10;
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
							answer[answer.indexOf(ans)] = "";
						} else {
							answer[answer.indexOf(ans)] = ans.replaceAll("$", "");
						}
					}
				}
			});

			const text = answer.join("\n");
			if (text) {
				console.log(`%c${text.trim()} `, 'color:LawnGreen;');
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
				const { content, alignment, coordinates, style } = label;
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
						realY += 15;
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
			canvas.width = this.width;
			canvas.height = this.height;

			const ctx = canvas.getContext("2d");
			ctx.fillStyle = "white";
			ctx.fillRect(0, 0, this.width, this.height);
			ctx.drawImage(this, 0, 0);

			const dataURL = canvas.toDataURL("image/png");
			const imageStyle = [
				`font-size: 0px;`,
				`padding: ${this.height * .5}px ${this.width * .5}px;`,
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

					Object.keys(question.widgets).map(widgetName => {
						if (question.content.includes(widgetName)) {
							switch (widgetName.split(" ")[0]) {
								case "input-number":
									return numericAnswerFrom(question).log();
								case "numeric-input":
									return freeResponseAnswerFrom(question).log();
								case "radio":
									return multipleChoiceAnswerFrom(question).log();
								case "expression":
									return expressionAnswerFrom(question).log();
								case "dropdown":
									return dropdownAnswerFrom(question).log();

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
				console.log("%c v1.1.0", "color: white; -webkit-text-stroke: .5px black; font-size:15px; font-weight:bold;");
				window.loaded = true;
			}

			return res;
		})
	}

	function numericAnswerFrom(question) {
		const answer = Object.values(question.widgets).map((widget) => {
			if (widget.options?.value) {
				return widget.options?.value
			}
		}).flat().filter((val) => { return val !== undefined; });

		return new Answer(answer, "free_response");
	}

	function freeResponseAnswerFrom(question) {
		const answer = Object.values(question.widgets).map((widget) => {
			if (widget.options?.answers) {
				return widget.options.answers.map(answer => {
					if (answer.status == "correct") {
						return answer.value;
					}
				});
			}
		}).flat().filter((val) => { return val !== undefined; });

		return new Answer(answer, "free_response");
	}

	function multipleChoiceAnswerFrom(question) {
		const answer = Object.values(question.widgets).map((widget) => {
			if (widget.options?.choices) {
				return widget.options.choices.map((choice, index) => {
					if (choice.correct) {
						return choice.content;
					}
				});
			}
		}).flat().filter((val) => { return val !== undefined; });

		return new Answer(answer, "multiple_choice");
	}

	function expressionAnswerFrom(question) {
		const answer = Object.values(question.widgets).map((widget) => {
			if (widget.options?.answerForms) {
				return widget.options.answerForms.map(answer => {
					if (Object.values(answer).includes("correct")) {
						return answer.value;
					}
				});
			}
		}).flat();

		return new Answer(answer, "expression");
	}

	function dropdownAnswerFrom(question) {
		const answer = Object.values(question.widgets).map((widget) => {
			if (widget.options?.choices) {
				return widget.options.choices.map(choice => {
					if (choice.correct) {
						return choice.content;
					}
				});
			}
		}).flat();

		return new Answer(answer, "dropdown");
	}
})();