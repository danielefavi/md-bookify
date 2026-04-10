# The Mathematics of Music

> *"Music is the pleasure the human soul experiences from counting without being aware that it is counting."*
> — Gottfried Wilhelm Leibniz

![Sample frontispiece](https://placehold.co/800x300/2c3e50/ecf0f1?text=The+Mathematics+of+Music)

---

## Preface

This is a sample chapter intended to exercise EPUB rendering across e-readers. It mixes long-form prose, mathematical notation, code examples, footnotes, and images — the kinds of content you would expect from a popular-science ebook. The goal is to test the *reflowable* layout that e-ink readers, tablets, and reading apps share, while avoiding constructs (page margins, fixed widths, complex HTML, inline styles) that only make sense in print.

If you are reading this on an e-reader, try changing the font size, switching between serif and sans-serif, and toggling the reading theme. Each of these should work without breaking the layout. Try the table of contents — every chapter heading below should be reachable from it. Tap a footnote marker; on most readers it should pop up inline rather than jumping to the end of the book.

## Chapter 1 — Pythagoras and the Monochord

Long before there were synthesizers, before there were pianos, before there were even fixed-pitch instruments of any kind, there was a single string stretched across a wooden plank. The Greek philosopher Pythagoras is said to have noticed something curious about this instrument, the *monochord*: when you stop the string at exactly half its length, the note it produces sounds *the same* as the open string, only higher.[^pythagoras] When you stop it at two-thirds, the resulting note sounds *consonant* with the open string — pleasant, stable, harmonious. When you stop it at three-quarters, you get a different consonance, slightly less stable but still agreeable.

This was, in its quiet way, one of the great discoveries of antiquity. It suggested that the qualities we call *musical* — concord, dissonance, melody, harmony — were not arbitrary expressions of human taste, but reflections of simple ratios between whole numbers. The universe, Pythagoras concluded, was built out of arithmetic. He may have been wrong about a great many things, but on this point he was strikingly close to correct.

[^pythagoras]: Pythagoras almost certainly did not perform this experiment himself. The monochord story comes to us through Nicomachus of Gerasa, writing some six centuries later, and the experiment as described would have been difficult to carry out with the equipment available in the sixth century BCE. But the *idea* it expresses — that sound and number are linked — is older than any single name, and it has been rediscovered, refined, and rebuilt many times since.

### The simple ratios

The intervals Pythagoras identified can be summarized as a small handful of whole-number ratios. Each ratio expresses the relative lengths of two strings, or equivalently the inverse ratio of their frequencies:

| Interval | Ratio | Modern name |
|---|---|---|
| Unison | 1 : 1 | Same note |
| Octave | 2 : 1 | Octave |
| Perfect fifth | 3 : 2 | Fifth |
| Perfect fourth | 4 : 3 | Fourth |
| Major third | 5 : 4 | Major third |
| Minor third | 6 : 5 | Minor third |

These ratios are properties of the physics of vibration, not of any particular instrument. They work for strings, for pipes, for tuning forks, for the resonant cavities of brass instruments, and for the human voice. They are, as far as anyone has been able to tell, properties of the universe.

## Chapter 2 — Frequencies and the Octave

If a string vibrates at a frequency $f$, halving its length doubles the frequency to $2f$. We hear that doubled frequency as an *octave* above the original. This is the most fundamental relationship in music, and it is also the one most often taken for granted.

The relationship between frequency and pitch is *logarithmic*: each successive octave doubles the frequency, but to our ears each octave sounds like an equal step. A note one octave above A4 (440 Hz) is A5 (880 Hz); the next octave above that is A6 (1760 Hz); the next is A7 (3520 Hz). The arithmetic differences grow exponentially, but the perceptual distance — the felt sense of "one octave higher" — stays the same.

We can write the frequency of any note in equal temperament as:

$$
f_n = f_0 \cdot 2^{n / 12}
$$

where $f_0$ is a reference frequency (conventionally A4 = 440 Hz) and $n$ is the number of semitones above (or below, if negative) the reference. Twelve semitones make an octave, and $2^{12/12} = 2$, which is the doubling we expected.

A more compact way to express the same idea is the *cent*, a unit equal to one twelve-hundredth of an octave. The interval in cents between two frequencies $f_0$ and $f_1$ is:

$$
c = 1200 \cdot \log_2 \left( \frac{f_1}{f_0} \right)
$$

A semitone is 100 cents; a perfect fifth in equal temperament is 700 cents; a Pythagorean (just) fifth is approximately 701.96 cents. That two-cent gap is small but audible to a trained ear, and it is the source of centuries of arguments about *temperament* — about which slight imperfection a tuning system should accept in exchange for which other.

## Chapter 3 — Synthesizing a Note

A pure musical tone is a *sine wave*: a single frequency, vibrating cleanly in time. We can describe it with the equation:

$$
y(t) = A \sin(2 \pi f t + \phi)
$$

where $A$ is amplitude (loudness), $f$ is frequency (pitch), and $\phi$ is the phase. Most real sounds are not single sine waves; they are sums of many, each with its own amplitude and phase. The recipe — which sine waves to add together, in what proportions — is what gives a violin its violin-ness and a flute its flute-ness. Two instruments playing the same written note produce two completely different waveforms, and yet our ears, given a moment, can usually identify both.

### A first synthesizer, in JavaScript

Here is a small function that generates one second of a sine wave at a given frequency, suitable for handing to a Web Audio buffer:

```javascript
function generateSineWave(frequency, sampleRate = 44100, duration = 1) {
  const sampleCount = Math.floor(sampleRate * duration);
  const buffer = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    buffer[i] = Math.sin(2 * Math.PI * frequency * t);
  }
  return buffer;
}

// Concert A — the note an oboe plays at the start of a symphony.
const a440 = generateSineWave(440);
```

The same idea, in Python, using NumPy:

```python
import numpy as np

def generate_sine_wave(
    frequency: float,
    sample_rate: int = 44100,
    duration: float = 1.0,
) -> np.ndarray:
    """Return one channel of mono PCM samples for a pure sine wave."""
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    return np.sin(2 * np.pi * frequency * t)


a440 = generate_sine_wave(440)
```

Both functions return an array of samples — numbers between -1 and 1, one for every fraction of a second — that you can hand to your operating system's audio output. There is nothing in the mathematics that tells you what concert A *should* sound like; the number 440 is a 20th-century convention, and at various points in history A has been tuned as low as 392 Hz and as high as 466 Hz.[^pitchhistory]

[^pitchhistory]: For most of European history, there was no standard pitch at all. Different cities, different churches, and different orchestras tuned to whatever felt right or whatever their organ happened to be built for. The 440 Hz convention was only formally adopted at an international conference in 1939, and even today the Vienna Philharmonic tunes a few cents higher.

### Adding harmonics

A square wave is built by summing the *odd harmonics* of a sine, with each harmonic at a smaller amplitude:

$$
y(t) = \sum_{k=0}^{\infty} \frac{1}{2k+1} \sin\bigl((2k+1) \cdot 2 \pi f t\bigr)
$$

Truncate that sum at five or ten terms and you have a recognisable, slightly buzzy square. Truncate at fifty and it sounds almost crisp. The shape of the sound, in other words, is the shape of its spectrum: the relative weights of the harmonics that go into it.

## Chapter 4 — A Brief Tour of Tunings

Every tuning system is a compromise. There are infinitely many consonant ratios in nature, and only twelve notes in a Western octave. Different cultures, and different eras, have apportioned those twelve notes in different ways:

1. **Pythagorean tuning** stacks pure fifths (3 : 2) on top of one another. Most intervals come out beautifully consonant; one — the so-called *wolf fifth* — comes out wretchedly out of tune, because twelve perfect fifths do not quite equal seven octaves.
2. **Just intonation** uses small whole-number ratios for each interval relative to a tonic. This sounds glorious in one key and terrible in any other; modulating to a distant key reveals dissonances that the tuning was never designed to handle.
3. **Meantone temperament** flattens the fifths slightly so that the major thirds come out cleaner. It dominated keyboard music from the late Renaissance to the early Baroque.
4. **Well temperament** distributes the imperfection unevenly, giving each key its own character without making any key unplayable. This is the world Bach was writing in when he composed *The Well-Tempered Clavier*.
5. **Equal temperament** divides the octave into twelve perfectly equal semitones. Every interval is slightly off from its pure ratio, but every key sounds identical. This is the world of the modern piano, the modern guitar, and the modern synthesizer.

There is no winner among these systems; there are only trades. Equal temperament gives us the freedom to modulate freely between any two keys, at the cost of never quite being in tune with any of them.

> A piano in equal temperament is not in tune with itself. It is in tune with every other piano in equal temperament. That is the trade, and it is the trade that defines almost all the music you have ever heard.

The old systems are not gone. String quartets, choirs, and brass ensembles routinely drift toward just intonation when they sustain a chord, because the human ear *prefers* the pure ratios when given the chance. Equal temperament is what we tune our fixed instruments to; it is not, quite, what we sing.

## Appendix A — Note Frequencies in Equal Temperament

For reference, here are the frequencies of the notes from A3 to A4, in standard equal temperament with A4 = 440 Hz:

| Note | Frequency (Hz) | Cents above A3 |
|---|---:|---:|
| A3  | 220.00 | 0 |
| A♯3 | 233.08 | 100 |
| B3  | 246.94 | 200 |
| C4  | 261.63 | 300 |
| C♯4 | 277.18 | 400 |
| D4  | 293.66 | 500 |
| D♯4 | 311.13 | 600 |
| E4  | 329.63 | 700 |
| F4  | 349.23 | 800 |
| F♯4 | 369.99 | 900 |
| G4  | 392.00 | 1000 |
| G♯4 | 415.30 | 1100 |
| A4  | 440.00 | 1200 |

## Appendix B — Further Reading

The literature on the mathematics of music is vast, and parts of it are surprisingly readable. A few starting points:

- *On the Sensations of Tone* by Hermann von Helmholtz (1863) — the foundational text on the physics and physiology of music. Long, but written for a general audience, and the diagrams are extraordinary.
- *How Equal Temperament Ruined Harmony* by Ross W. Duffin (2007) — a pointed and entertaining defence of older tunings, written for non-specialists.
- *This Is Your Brain on Music* by Daniel J. Levitin (2006) — accessible, contemporary, full of footnotes worth chasing.
- *Temperament: The Idea That Solved Music's Greatest Riddle* by Stuart Isacoff (2001) — a narrative history of how equal temperament won.

Online, the [Helmholtz–Ellis pitch notation](https://en.wikipedia.org/wiki/Helmholtz%E2%80%93Ellis_notation) reference and the [Pythagoras tuning calculator](https://example.com/pythagoras) are both worth a visit.

## Appendix C — A Short Glossary

- **Cent** &mdash; one twelve-hundredth of an octave; the smallest interval most listeners can reliably distinguish.
- **Equal temperament** &mdash; a tuning system in which the octave is divided into twelve perfectly equal semitones.
- **Frequency** &mdash; the number of times per second a sound wave completes one full cycle, measured in hertz (Hz).
- **Harmonic** &mdash; an integer multiple of a fundamental frequency.
- **Just intonation** &mdash; a tuning system based on small whole-number frequency ratios.
- **Monochord** &mdash; a single-stringed instrument used since antiquity to study musical ratios.
- **Octave** &mdash; the interval between two notes whose frequencies stand in the ratio 2 : 1.
- **Sine wave** &mdash; the simplest possible periodic waveform; a single, pure frequency.
- **Temperament** &mdash; any system for adjusting the tuning of an instrument to make multiple keys playable.

---

*End of sample chapter. If you have made it this far, the reflowable layout is doing its job.*
