/** Fail-closed deprecated GitHub OIDC writer: no productive API endpoint or
 * personal identifiers in repository source. A future non-CI import requires
 * independently approved source rights and explicit verification.
 */
export async function stageFreshResults(){
 throw Error("Production match staging from GitHub Actions is disabled");
}
