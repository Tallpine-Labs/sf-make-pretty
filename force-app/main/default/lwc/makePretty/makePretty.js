import { LightningElement, api } from "lwc";
import CARD_TITLE from "@salesforce/label/c.MakePretty_CardTitle";
import FIELD_LABEL from "@salesforce/label/c.MakePretty_FieldLabel";
import PLACEHOLDER from "@salesforce/label/c.MakePretty_Placeholder";
import PRETTIFY_BUTTON from "@salesforce/label/c.MakePretty_PrettifyButton";
import DECODE_BUTTON from "@salesforce/label/c.MakePretty_DecodeButton";
import INVALID_JSON from "@salesforce/label/c.MakePretty_InvalidJson";
import INVALID_XML from "@salesforce/label/c.MakePretty_InvalidXml";
import INVALID_CONTENT from "@salesforce/label/c.MakePretty_InvalidContent";
import INVALID_BASE64 from "@salesforce/label/c.MakePretty_InvalidBase64";

const INDENT = "    ";
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_NODE = 4;
const PROCESSING_INSTRUCTION_NODE = 7;
const COMMENT_NODE = 8;

export default class MakePretty extends LightningElement {
  @api cardTitle;
  @api fieldLabel;
  @api placeholder;
  @api prettifyLabel;
  @api decodeLabel;
  @api hideTitle = false;

  content = "";
  errorMessage = "";

  get resolvedCardTitle() {
    return this.hideTitle ? undefined : this.cardTitle || CARD_TITLE;
  }

  get resolvedIconName() {
    return this.hideTitle ? undefined : "utility:description";
  }

  get cardClass() {
    return this.hideTitle ? "collapse-empty-header" : "";
  }

  get resolvedFieldLabel() {
    return this.fieldLabel || FIELD_LABEL;
  }

  get resolvedPlaceholder() {
    return this.placeholder || PLACEHOLDER;
  }

  get resolvedPrettifyLabel() {
    return this.prettifyLabel || PRETTIFY_BUTTON;
  }

  get resolvedDecodeLabel() {
    return this.decodeLabel || DECODE_BUTTON;
  }

  get isEmpty() {
    return this.content.trim().length === 0;
  }

  get formElementClass() {
    return this.errorMessage
      ? "slds-form-element slds-has-error"
      : "slds-form-element";
  }

  handleInput(event) {
    this.content = event.target.value;
    this.errorMessage = "";
  }

  handlePrettify() {
    const source = this.content.trim();
    const looksXml = source.startsWith("<");
    const looksJson = source.startsWith("{") || source.startsWith("[");
    try {
      this.content = looksXml
        ? this.formatXml(source)
        : this.formatJson(source);
      this.refs.sourceInput.value = this.content;
      this.errorMessage = "";
    } catch (error) {
      // Only name a format when the opening character commits to one.
      if (looksXml) {
        this.errorMessage = `${INVALID_XML}: ${error.message}`;
      } else if (looksJson) {
        this.errorMessage = `${INVALID_JSON}: ${error.message}`;
      } else {
        this.errorMessage = INVALID_CONTENT;
      }
    }
  }

  handleDecode() {
    try {
      const binary = atob(this.content.replace(/\s/g, ""));
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      this.content = new TextDecoder().decode(bytes);
      this.refs.sourceInput.value = this.content;
      this.errorMessage = "";
    } catch {
      this.errorMessage = INVALID_BASE64;
    }
  }

  formatJson(source) {
    return JSON.stringify(JSON.parse(source), null, INDENT.length);
  }

  formatXml(source) {
    const doc = new DOMParser().parseFromString(source, "application/xml");
    const failure = doc.getElementsByTagName("parsererror")[0];
    if (failure) {
      throw new Error(failure.textContent.trim().split("\n")[0]);
    }

    const body = Array.from(doc.childNodes)
      .map((node) => this.serializeNode(node, 0))
      .filter(Boolean)
      .join("\n");

    // The XML declaration is not exposed as a node, so carry it over verbatim.
    const declaration = source.match(/^<\?xml[^?]*\?>/);
    return declaration ? `${declaration[0]}\n${body}` : body;
  }

  serializeNode(node, depth) {
    const pad = INDENT.repeat(depth);
    switch (node.nodeType) {
      case ELEMENT_NODE:
        return this.serializeElement(node, depth);
      case TEXT_NODE: {
        const text = node.nodeValue.trim();
        return text ? `${pad}${this.escapeText(text)}` : "";
      }
      case CDATA_NODE:
        return `${pad}<![CDATA[${node.nodeValue}]]>`;
      case PROCESSING_INSTRUCTION_NODE:
        return `${pad}<?${node.target} ${node.data}?>`;
      case COMMENT_NODE:
        return `${pad}<!--${node.nodeValue.trim()}-->`;
      default:
        return "";
    }
  }

  serializeElement(node, depth) {
    const pad = INDENT.repeat(depth);
    const name = node.nodeName;
    const attributes = Array.from(node.attributes)
      .map((attr) => ` ${attr.name}="${this.escapeAttribute(attr.value)}"`)
      .join("");
    const children = Array.from(node.childNodes).filter(
      (child) => child.nodeType !== TEXT_NODE || child.nodeValue.trim() !== ""
    );

    if (children.length === 0) {
      return `${pad}<${name}${attributes} />`;
    }

    if (children.length === 1 && children[0].nodeType === TEXT_NODE) {
      const text = this.escapeText(children[0].nodeValue.trim());
      return `${pad}<${name}${attributes}>${text}</${name}>`;
    }

    const inner = children
      .map((child) => this.serializeNode(child, depth + 1))
      .filter(Boolean)
      .join("\n");
    return `${pad}<${name}${attributes}>\n${inner}\n${pad}</${name}>`;
  }

  escapeText(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  escapeAttribute(value) {
    return this.escapeText(value).replace(/"/g, "&quot;");
  }
}