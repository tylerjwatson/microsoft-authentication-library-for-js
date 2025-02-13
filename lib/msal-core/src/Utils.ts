// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IUri } from "./IUri";
import { Account } from "./Account";
import {Constants, SSOTypes, PromptState} from "./Constants";
import { AuthenticationParameters } from "./AuthenticationParameters";
import { AuthResponse } from "./AuthResponse";
import { IdToken } from "./IdToken";
import { Library } from "./Constants";
import { StringDict } from "./MsalTypes";

/**
 * @hidden
 */
export class Utils {

  //#region General Util

  /**
   * Utils function to compare two Account objects - used to check if the same user account is logged in
   *
   * @param a1: Account object
   * @param a2: Account object
   */
  static compareAccounts(a1: Account, a2: Account): boolean {
   if (!a1 || !a2) {
          return false;
      }
    if (a1.homeAccountIdentifier && a2.homeAccountIdentifier) {
      if (a1.homeAccountIdentifier === a2.homeAccountIdentifier) {
        return true;
      }
    }
    return false;
  }

  /**
   * Decimal to Hex
   *
   * @param num
   */
  static decimalToHex(num: number): string {
    var hex: string = num.toString(16);
    while (hex.length < 2) {
      hex = "0" + hex;
    }
    return hex;
  }

  /**
   * MSAL JS Library Version
   */
  static getLibraryVersion(): string {
    return Library.version;
  }

  /**
   * Creates a new random GUID - used to populate state?
   * @returns string (GUID)
   */
  static createNewGuid(): string {
    // RFC4122: The version 4 UUID is meant for generating UUIDs from truly-random or
    // pseudo-random numbers.
    // The algorithm is as follows:
    //     Set the two most significant bits (bits 6 and 7) of the
    //        clock_seq_hi_and_reserved to zero and one, respectively.
    //     Set the four most significant bits (bits 12 through 15) of the
    //        time_hi_and_version field to the 4-bit version number from
    //        Section 4.1.3. Version4
    //     Set all the other bits to randomly (or pseudo-randomly) chosen
    //     values.
    // UUID                   = time-low "-" time-mid "-"time-high-and-version "-"clock-seq-reserved and low(2hexOctet)"-" node
    // time-low               = 4hexOctet
    // time-mid               = 2hexOctet
    // time-high-and-version  = 2hexOctet
    // clock-seq-and-reserved = hexOctet:
    // clock-seq-low          = hexOctet
    // node                   = 6hexOctet
    // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    // y could be 1000, 1001, 1010, 1011 since most significant two bits needs to be 10
    // y values are 8, 9, A, B

    const cryptoObj: Crypto = window.crypto; // for IE 11
    if (cryptoObj && cryptoObj.getRandomValues) {
      const buffer: Uint8Array = new Uint8Array(16);
      cryptoObj.getRandomValues(buffer);

      //buffer[6] and buffer[7] represents the time_hi_and_version field. We will set the four most significant bits (4 through 7) of buffer[6] to represent decimal number 4 (UUID version number).
      buffer[6] |= 0x40; //buffer[6] | 01000000 will set the 6 bit to 1.
      buffer[6] &= 0x4f; //buffer[6] & 01001111 will set the 4, 5, and 7 bit to 0 such that bits 4-7 == 0100 = "4".

      //buffer[8] represents the clock_seq_hi_and_reserved field. We will set the two most significant bits (6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively.
      buffer[8] |= 0x80; //buffer[8] | 10000000 will set the 7 bit to 1.
      buffer[8] &= 0xbf; //buffer[8] & 10111111 will set the 6 bit to 0.

      return Utils.decimalToHex(buffer[0]) + Utils.decimalToHex(buffer[1])
        + Utils.decimalToHex(buffer[2]) + Utils.decimalToHex(buffer[3])
        + "-" + Utils.decimalToHex(buffer[4]) + Utils.decimalToHex(buffer[5])
        + "-" + Utils.decimalToHex(buffer[6]) + Utils.decimalToHex(buffer[7])
        + "-" + Utils.decimalToHex(buffer[8]) + Utils.decimalToHex(buffer[9])
        + "-" + Utils.decimalToHex(buffer[10]) + Utils.decimalToHex(buffer[11])
        + Utils.decimalToHex(buffer[12]) + Utils.decimalToHex(buffer[13])
        + Utils.decimalToHex(buffer[14]) + Utils.decimalToHex(buffer[15]);
    }
    else {
      const guidHolder: string = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
      const hex: string = "0123456789abcdef";
      let r: number = 0;
      let guidResponse: string = "";
      for (let i: number = 0; i < 36; i++) {
        if (guidHolder[i] !== "-" && guidHolder[i] !== "4") {
          // each x and y needs to be random
          r = Math.random()  * 16 | 0;
        }
        if (guidHolder[i] === "x") {
          guidResponse += hex[r];
        } else if (guidHolder[i] === "y") {
          // clock-seq-and-reserved first hex is filtered and remaining hex values are random
          r &= 0x3; // bit and with 0011 to set pos 2 to zero ?0??
          r |= 0x8; // set pos 3 to 1 as 1???
          guidResponse += hex[r];
        } else {
          guidResponse += guidHolder[i];
        }
      }
      return guidResponse;
    }
  }

  //#endregion

  //#region Time

  /**
   * Returns time in seconds for expiration based on string value passed in.
   *
   * @param expiresIn
   */
  static parseExpiresIn(expiresIn: string): number {
    // if AAD did not send "expires_in" property, use default expiration of 3599 seconds, for some reason AAD sends 3599 as "expires_in" value instead of 3600
    if (!expiresIn) {
      expiresIn = "3599";
    }
    return parseInt(expiresIn, 10);
  }

  /**
   * return the current time in Unix time. Date.getTime() returns in milliseconds.
   */
  static now(): number {
    return Math.round(new Date().getTime() / 1000.0);
  }

  //#endregion

  //#region String Ops

  /**
   * Check if a string is empty
   *
   * @param str
   */
  static isEmpty(str: string): boolean {
    return (typeof str === "undefined" || !str || 0 === str.length);
  }

  //#endregion

  //#region Token Processing (Extract to TokenProcessing.ts)

  /**
   * decode a JWT
   *
   * @param jwtToken
   */
  static decodeJwt(jwtToken: string): any {
    if (this.isEmpty(jwtToken)) {
      return null;
    }
    const idTokenPartsRegex = /^([^\.\s]*)\.([^\.\s]+)\.([^\.\s]*)$/;
    const matches = idTokenPartsRegex.exec(jwtToken);
    if (!matches || matches.length < 4) {
      //this._requestContext.logger.warn("The returned id_token is not parseable.");
      return null;
    }
    const crackedToken = {
      header: matches[1],
      JWSPayload: matches[2],
      JWSSig: matches[3]
    };
    return crackedToken;
  }

  /**
   * Extract IdToken by decoding the RAWIdToken
   *
   * @param encodedIdToken
   */
  static extractIdToken(encodedIdToken: string): any {
    // id token will be decoded to get the username
    const decodedToken = this.decodeJwt(encodedIdToken);
    if (!decodedToken) {
      return null;
    }
    try {
      const base64IdToken = decodedToken.JWSPayload;
      const base64Decoded = this.base64Decode(base64IdToken);
      if (!base64Decoded) {
        //this._requestContext.logger.info("The returned id_token could not be base64 url safe decoded.");
        return null;
      }
      // ECMA script has JSON built-in support
      return JSON.parse(base64Decoded);
    } catch (err) {
      //this._requestContext.logger.error("The returned id_token could not be decoded" + err);
    }

    return null;
  }

  //#endregion

  //#region Encode and Decode

  // See: https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#Solution_4_%E2%80%93_escaping_the_string_before_encoding_it

  /**
   * encoding string to base64 - platform specific check
   *
   * @param input
   */
  static base64Encode(input: string): string {
    return btoa(encodeURIComponent(input).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode(Number("0x" + p1));
    }));
  }

  /**
   * decoding base64 token - platform specific check
   *
   * @param base64IdToken
   */
  static base64Decode(input: string): string {
    return decodeURIComponent(atob(input).split("").map(function(c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(""));
  }

  /**
   * deserialize a string
   *
   * @param query
   */
  static deserialize(query: string): any {
    let match: Array<string>; // Regex for replacing addition symbol with a space
    const pl = /\+/g;
    const search = /([^&=]+)=([^&]*)/g;
    const decode = (s: string) => decodeURIComponent(s.replace(pl, " "));
    const obj: {} = {};
    match = search.exec(query);
    while (match) {
      obj[decode(match[1])] = decode(match[2]);
      match = search.exec(query);
    }
    return obj;
  }

  //#endregion

  //#region Scopes (extract to Scopes.ts)

  /**
   * Check if there are dup scopes in a given request
   *
   * @param cachedScopes
   * @param scopes
   */
  // TODO: Rename this, intersecting scopes isn't a great name for duplicate checker
  static isIntersectingScopes(cachedScopes: Array<string>, scopes: Array<string>): boolean {
    cachedScopes = this.convertToLowerCase(cachedScopes);
    for (let i = 0; i < scopes.length; i++) {
        if (cachedScopes.indexOf(scopes[i].toLowerCase()) > -1) {
            return true;
        }
    }
    return false;
  }

  /**
   * Check if a given scope is present in the request
   *
   * @param cachedScopes
   * @param scopes
   */
  static containsScope(cachedScopes: Array<string>, scopes: Array<string>): boolean {
    cachedScopes = this.convertToLowerCase(cachedScopes);
    return scopes.every((value: any): boolean => cachedScopes.indexOf(value.toString().toLowerCase()) >= 0);
  }

  /**
   * toLower
   *
   * @param scopes
   */
  // TODO: Rename this, too generic name for a function that only deals with scopes
  static convertToLowerCase(scopes: Array<string>): Array<string> {
    return scopes.map(scope => scope.toLowerCase());
  }

  /**
   * remove one element from a scope array
   *
   * @param scopes
   * @param scope
   */
  // TODO: Rename this, too generic name for a function that only deals with scopes
  static removeElement(scopes: Array<string>, scope: string): Array<string> {
    return scopes.filter(value => value !== scope);
  }

  //#endregion

  //#region URL Processing (Extract to UrlProcessing.ts?)

  static getDefaultRedirectUri(): string {
      return window.location.href.split("?")[0].split("#")[0];
  }

  /**
   * Given a url like https://a:b/common/d?e=f#g, and a tenantId, returns https://a:b/tenantId/d
   * @param href The url
   * @param tenantId The tenant id to replace
   */
  static replaceTenantPath(url: string, tenantId: string): string {
      url = url.toLowerCase();
      var urlObject = this.GetUrlComponents(url);
      var pathArray = urlObject.PathSegments;
      if (tenantId && (pathArray.length !== 0 && (pathArray[0] === Constants.common || pathArray[0] === SSOTypes.ORGANIZATIONS))) {
        pathArray[0] = tenantId;
      }
      return this.constructAuthorityUriFromObject(urlObject, pathArray);
  }

  static constructAuthorityUriFromObject(urlObject: IUri, pathArray: string[]) {
    return this.CanonicalizeUri(urlObject.Protocol + "//" + urlObject.HostNameAndPort + "/" + pathArray.join("/"));
  }

  /**
   * Parses out the components from a url string.
   * @returns An object with the various components. Please cache this value insted of calling this multiple times on the same url.
   */
  static GetUrlComponents(url: string): IUri {
    if (!url) {
      throw "Url required";
    }

    // https://gist.github.com/curtisz/11139b2cfcaef4a261e0
    var regEx = RegExp("^(([^:/?#]+):)?(//([^/?#]*))?([^?#]*)(\\?([^#]*))?(#(.*))?");

    var match = url.match(regEx);

    if (!match || match.length < 6) {
      throw "Valid url required";
    }

    let urlComponents = <IUri>{
      Protocol: match[1],
      HostNameAndPort: match[4],
      AbsolutePath: match[5]
    };

    let pathSegments = urlComponents.AbsolutePath.split("/");
    pathSegments = pathSegments.filter((val) => val && val.length > 0); // remove empty elements
    urlComponents.PathSegments = pathSegments;
    return urlComponents;
  }

  /**
   * Given a url or path, append a trailing slash if one doesnt exist
   *
   * @param url
   */
  static CanonicalizeUri(url: string): string {
    if (url) {
      url = url.toLowerCase();
    }

    if (url && !Utils.endsWith(url, "/")) {
      url += "/";
    }

    return url;
  }

  /**
   * Checks to see if the url ends with the suffix
   * Required because we are compiling for es5 instead of es6
   * @param url
   * @param str
   */
  // TODO: Rename this, not clear what it is supposed to do
  static endsWith(url: string, suffix: string): boolean {
    if (!url || !suffix) {
      return false;
    }

    return url.indexOf(suffix, url.length - suffix.length) !== -1;
  }

  /**
   * Utils function to remove the login_hint and domain_hint from the i/p extraQueryParameters
   * @param url
   * @param name
   */
  static urlRemoveQueryStringParameter(url: string, name: string): string {
    if (this.isEmpty(url)) {
      return url;
    }

    var regex = new RegExp("(\\&" + name + "=)[^\&]+");
    url = url.replace(regex, "");
    // name=value&
    regex = new RegExp("(" + name + "=)[^\&]+&");
    url = url.replace(regex, "");
    // name=value
    regex = new RegExp("(" + name + "=)[^\&]+");
    url = url.replace(regex, "");
    return url;
  }

  /**
   * @hidden
   * @ignore
   *
   * Returns the anchor part(#) of the URL
   */
  static getHashFromUrl(urlStringOrFragment: string): string {
    const index = urlStringOrFragment.indexOf("#");
    const indexWithSlash = urlStringOrFragment.indexOf("#/");
    if (indexWithSlash > -1) {
      return urlStringOrFragment.substring(indexWithSlash + 2);
    }
    if (index > -1) {
      return urlStringOrFragment.substring(index + 1);
    }
    return urlStringOrFragment;
  }

  //#endregion

  //#region ExtraQueryParameters Processing (Extract?)

  /**
   * Constructs extraQueryParameters to be sent to the server for the AuthenticationParameters set by the developer
   * in any login() or acquireToken() calls
   * @param idTokenObject
   * @param extraQueryParameters
   * @param sid
   * @param loginHint
   */
  //TODO: check how this behaves when domain_hint only is sent in extraparameters and idToken has no upn.
  static constructUnifiedCacheQueryParameter(request: AuthenticationParameters, idTokenObject: any): StringDict {

    // preference order: account > sid > login_hint
    let ssoType;
    let ssoData;
    let serverReqParam: StringDict = {};
    // if account info is passed, account.sid > account.login_hint
    if (request) {
      if (request.account) {
        const account: Account = request.account;
        if (account.sid) {
          ssoType = SSOTypes.SID;
          ssoData = account.sid;
        }
        else if (account.userName) {
          ssoType = SSOTypes.LOGIN_HINT;
          ssoData = account.userName;
        }
      }
      // sid from request
      else if (request.sid) {
        ssoType = SSOTypes.SID;
        ssoData = request.sid;
      }
      // loginHint from request
      else if (request.loginHint) {
        ssoType = SSOTypes.LOGIN_HINT;
        ssoData = request.loginHint;
      }
    }
    // adalIdToken retrieved from cache
    else if (idTokenObject) {
      if (idTokenObject.hasOwnProperty(Constants.upn)) {
        ssoType = SSOTypes.ID_TOKEN;
        ssoData = idTokenObject.upn;
      }
      else {
        ssoType = SSOTypes.ORGANIZATIONS;
        ssoData = null;
      }
    }

    serverReqParam = this.addSSOParameter(ssoType, ssoData);

    // add the HomeAccountIdentifier info/ domain_hint
    if (request && request.account && request.account.homeAccountIdentifier) {
        serverReqParam = this.addSSOParameter(SSOTypes.HOMEACCOUNT_ID, request.account.homeAccountIdentifier, serverReqParam);
    }

    return serverReqParam;
  }


  /**
   * Add SID to extraQueryParameters
   * @param sid
   */
  static addSSOParameter(ssoType: string, ssoData: string, ssoParam?: StringDict): StringDict {
    if (!ssoParam) {
      ssoParam = {};
    }

    if (!ssoData) {
        return ssoParam;
    }

    switch (ssoType) {
      case SSOTypes.SID: {
        ssoParam[SSOTypes.SID] = ssoData;
        break;
      }
      case SSOTypes.ID_TOKEN: {
        ssoParam[SSOTypes.LOGIN_HINT] = ssoData;
        ssoParam[SSOTypes.DOMAIN_HINT] = SSOTypes.ORGANIZATIONS;
        break;
      }
      case SSOTypes.LOGIN_HINT: {
        ssoParam[SSOTypes.LOGIN_HINT] = ssoData;
        break;
      }
      case SSOTypes.ORGANIZATIONS: {
        ssoParam[SSOTypes.DOMAIN_HINT] = SSOTypes.ORGANIZATIONS;
        break;
      }
      case SSOTypes.CONSUMERS: {
        ssoParam[SSOTypes.DOMAIN_HINT] = SSOTypes.CONSUMERS;
        break;
      }
      case SSOTypes.HOMEACCOUNT_ID: {
        let homeAccountId = ssoData.split(".");
        const uid = Utils.base64Decode(homeAccountId[0]);
        const utid = Utils.base64Decode(homeAccountId[1]);

        // TODO: domain_req and login_req are not needed according to eSTS team
        ssoParam[SSOTypes.LOGIN_REQ] = uid;
        ssoParam[SSOTypes.DOMAIN_REQ] = utid;

        if (utid === Constants.consumersUtid) {
            ssoParam[SSOTypes.DOMAIN_HINT] = SSOTypes.CONSUMERS;
        }
        else {
            ssoParam[SSOTypes.DOMAIN_HINT] = SSOTypes.ORGANIZATIONS;
        }
        break;
      }
      case SSOTypes.LOGIN_REQ: {
        ssoParam[SSOTypes.LOGIN_REQ] = ssoData;
        break;
      }
      case SSOTypes.DOMAIN_REQ: {
        ssoParam[SSOTypes.DOMAIN_REQ] = ssoData;
        break;
      }
    }

    return ssoParam;
  }

  /**
   * Utility to generate a QueryParameterString from a Key-Value mapping of extraQueryParameters passed
   * @param extraQueryParameters
   */
  static generateQueryParametersString(queryParameters: StringDict): string {
    let paramsString: string = null;

    if (queryParameters) {
      Object.keys(queryParameters).forEach((key: string) => {
        if (paramsString == null) {
          paramsString = `${key}=${encodeURIComponent(queryParameters[key])}`;
        }
        else {
          paramsString += `&${key}=${encodeURIComponent(queryParameters[key])}`;
        }
     });
    }

    return paramsString;
  }

  /**
   * Check to see if there are SSO params set in the Request
   * @param request
   */
  static isSSOParam(request: AuthenticationParameters) {
      return request && (request.account || request.sid || request.loginHint);
  }

  //#endregion

  //#region Response Helpers

  static setResponseIdToken(originalResponse: AuthResponse, idTokenObj: IdToken) : AuthResponse {

    let exp = Number(idTokenObj.expiration);
    if (exp && !originalResponse.expiresOn) {
        originalResponse.expiresOn = new Date(exp * 1000);
    }

    return {
      ...originalResponse,
      idToken: idTokenObj,
      idTokenClaims: idTokenObj.claims,
      uniqueId: idTokenObj.objectId || idTokenObj.subject,
      tenantId: idTokenObj.tenantId,
    };
  }

  //#endregion

}
