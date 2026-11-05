// TypeScript errors after site migration - ignoring for game functionality
import Warrior from "./classes/warrior";
import Dwarf from "./classes/dwarf";
import Cleric from "./classes/cleric";
import Elf from "./classes/elf";
import Wizard from "./classes/wizard";

const classes = {
  Warrior,
  Dwarf,
  Cleric,
  Elf,
  Wizard
};

// The class catalogue is kept intact so classes can be offered again later.
// While the picker is disabled, every new run uses this one hero.
export const DEFAULT_HERO_CLASS = "Wizard";

export default classes;
