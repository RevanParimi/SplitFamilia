# T-04 (SF-015): writes a copy of an 8-bit RGBA PNG as a 24-bit RGB PNG with no alpha channel, as
# Google Play asks for the feature graphic and screenshots. Each pixel is put on a solid background
# (default white), so a fully opaque image comes out pixel for pixel the same. Python's standard
# library only (zlib); no image library needed.
#   python T-04-flatten-png.py <input.png> <output.png> [background hex, e.g. 4F46E5]
import struct
import sys
import zlib


def chunks(data):
    pos = 8
    while pos < len(data):
        n = struct.unpack(">I", data[pos:pos + 4])[0]
        yield data[pos + 4:pos + 8], data[pos + 8:pos + 8 + n]
        pos += 12 + n


def read_rgba(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    idat = b""
    for kind, body in chunks(data):
        if kind == b"IHDR":
            width, height, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", body)
            assert depth == 8 and ctype == 6 and interlace == 0, "only 8-bit RGBA, not interlaced"
        elif kind == b"IDAT":
            idat += body
    raw = zlib.decompress(idat)
    stride = width * 4
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(height):
        kind, line = raw[i], bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - 4] if x >= 4 else 0
            b = prev[x]
            c = prev[x - 4] if x >= 4 else 0
            if kind == 1:
                line[x] = (line[x] + a) & 255
            elif kind == 2:
                line[x] = (line[x] + b) & 255
            elif kind == 3:
                line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif kind == 4:
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    return width, height, rows


def write_rgb(path, width, height, rows, background):
    out = bytearray()
    for line in rows:
        out.append(0)
        for x in range(0, len(line), 4):
            alpha = line[x + 3]
            for k in range(3):
                out.append((line[x + k] * alpha + background[k] * (255 - alpha) + 127) // 255)

    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(out), 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(png)


if __name__ == "__main__":
    source, target = sys.argv[1], sys.argv[2]
    hexcolor = sys.argv[3] if len(sys.argv) > 3 else "FFFFFF"
    background = bytes.fromhex(hexcolor)
    w, h, rows = read_rgba(source)
    partial = sum(1 for line in rows for x in range(3, len(line), 4) if line[x] != 255)
    write_rgb(target, w, h, rows, background)
    print(f"{w}x{h}: {partial} pixels not fully opaque; written as 24-bit RGB to {target}")
