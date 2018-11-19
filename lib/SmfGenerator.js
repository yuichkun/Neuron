const Utils = require('./Utils');
const JZZ = require('jzz');
require('jzz-midi-smf')(JZZ);

class SmfGenerator {
    constructor(initInfo){
        this.ppqr = initInfo.ppqr;
        this.pitchBendRange = initInfo.pitchBendRange;
        this.defaultVelocity = initInfo.defaultVelocity;
        const splitedPath = initInfo.outputFilepath.split('/');
        this.seqName = splitedPath[splitedPath.length-1];
    }
    
    process(data){
        return new Promise((resolve, reject) => {
            console.log('Generating...');
            data.smf = new JZZ.MIDI.SMF(1, this.ppqr); // type 0 or 1
            let trk = new JZZ.MIDI.SMF.MTrk;
            data.smf.push(trk);
            data.activeNotes = Utils.create2DArray(data.amps.length);
            
            // If the data does not use full 16ch, start adding msgs from 2nd channel. (for MPE compatibility)
            let startChannel, endChannel;
            if(data.amps.length > 15){
                startChannel = 1;
                endChannel = data.amps.length;
            }else{
                startChannel = 2;
                endChannel = data.amps.length + 1;
            }
            // add msgs in channel order
            for (let i = startChannel - 1; i < endChannel-1; i++){
                console.log("Now processing " + Number(i+1) + "ch...");
                addNoteMsgs(i, this.defaultVelocity);        // add noteOn and noteOff messages
                addPitchBendMsgs(i, this.pitchBendRange);   // add freqs to Pitchbend Messages
                addPressureMsgs(i);    // add amps to Aftertouch Messages
            }
            trk.add(0, JZZ.MIDI.smfSeqName(this.seqName)) 
            .add(1920, JZZ.MIDI.smfEndOfTrack()); 
            // console.log(data.smf);
            resolve(data)
        

            function addNoteMsgs(ch, defaultVelocity){
                let activeNote = null;
                data.noteOnOff[ch].forEach((val, idx) => {
                    if (val == 1) {
                        let noteNum = data.quantizedNoteNum[ch][idx];
                        let msg = JZZ.MIDI.noteOn(ch, noteNum, defaultVelocity);
                        trk.add(data.timecode[idx], msg);
                        activeNote = noteNum;
                    }else if (val == -1){
                        let msg = JZZ.MIDI.noteOff(ch, activeNote);
                        trk.add(data.timecode[idx], msg);
                        activeNote = null;
                        
                    }
                    
                    data.activeNotes[ch].push(activeNote);
                })
            }

            function addPitchBendMsgs(ch, pitchBendRange){
                data.freqs[ch].forEach((val, idx) => {
                    if (data.activeNotes[ch][idx]){
                        let byte2; let byte3;
                        [byte2, byte3] = Utils.calcPitchBend(val, data.activeNotes[ch][idx], pitchBendRange);
                        let byte1 = '0x' + (ch+224).toString(16).toUpperCase();
                        let msg = new JZZ.MIDI([byte1, byte2, byte3]);
                        trk.add(data.timecode[idx], msg);
                    }
                })
            }

            function addPressureMsgs(ch){
                data.amps[ch].forEach((val, idx) => {
                    const msg = JZZ.MIDI.pressure(ch, Math.floor(val*127));
                    trk.add(data.timecode[idx], msg);
                });
            }
        })
    }
}

module.exports = SmfGenerator;