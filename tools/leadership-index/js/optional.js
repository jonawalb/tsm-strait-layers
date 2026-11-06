// Guarded loader for data modules written by other agents. A missing or broken file gives null,
// and the feature that needs it stays hidden. A fixture build reads data/raw_fixture/<name>_fixture.js instead.
export async function loadOptional(name, exportName, fixture) {
  try {
    const m = await import(fixture ? `../data/raw_fixture/${name}_fixture.js` : `../data/${name}.js`);
    return m[exportName] || null;
  } catch {
    return null;
  }
}
