start = SEQUENCE

NUMBER = characters:[0-9]+ { return parseInt(characters.join(""), 10); }

AMOUNT = repetition:NUMBER "'" { return -repetition; }
       / NUMBER
       / "'" { return -1; }

FAMILY = characters:[_A-Za-z]+ { return characters.join(""); }
BLOCK_MOVE = family:FAMILY { return {type: "blockMove", family: family}; }
           / innerLayer:NUMBER family:FAMILY { return {type: "blockMove", family: family, innerLayer: innerLayer}; }
           / outerLayer:NUMBER "-" innerLayer:NUMBER family:FAMILY { return {type: "blockMove", family: family, outerLayer: outerLayer, innerLayer: innerLayer}; }

REPEATABLE_UNIT = BLOCK_MOVE
                // We parse commutators/conjugates together to reduce branching.
                / "[" a:SEQUENCE separator:[,:] b:SEQUENCE "]" { return {"type": separator === "," ? "commutator" : "conjugate", "A": a, "B": b}; }
                / "(" nestedSequence:SEQUENCE ")" { return {"type": "group", "nestedSequence": nestedSequence}; }

REPEATED_UNIT = repeatable_unit:REPEATABLE_UNIT amount:AMOUNT { repeatable_unit.amount = amount; return repeatable_unit; }
              / repeatable_unit:REPEATABLE_UNIT { repeatable_unit.amount = 1; return repeatable_unit; }

COMMENT = "//" body:[^\n\r]* { return {type: "commentShort", comment: body.join("")}; }
        / "/\*" body:[^\*]* "\*/" { return {type: "commentLong", comment: body.join("")}; }

ANNOTATION = [\n\r] { return {"type": "newLine"}; }
           / "." { return {"type": "pause"}; }
           / COMMENT

UNIT_SEGMENT = repeated_unit:REPEATED_UNIT unit_segment:UNIT_SEGMENT { return [repeated_unit].concat(unit_segment); }
             / annotation:ANNOTATION unit_segment:UNIT_SEGMENT { return [annotation].concat(unit_segment); }
             / repeated_unit:REPEATED_UNIT { return [repeated_unit]; }
             / annotation:ANNOTATION { return [annotation]; }

UNIT_LIST = unit_segment:UNIT_SEGMENT [ ]+ unit_list:UNIT_LIST { return unit_segment.concat(unit_list); }
          / UNIT_SEGMENT

SEQUENCE = [ ]* unit_list:UNIT_LIST [ ]* { return {"type": "sequence", "nestedUnits": unit_list}; }
         / [ ]* { return {"type": "sequence", "nestedUnits": []}; }
