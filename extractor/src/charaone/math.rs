// A faithful port of the slice of Blender's `mathutils` the construct stage relies on:
// the YXZ Euler <-> quaternion conversions, the Hamilton product, and conjugation. The
// addon builds animation curves with `mathutils.Quaternion`/`Euler(..., 'YXZ')`; matching
// those conventions (axes i=Y, j=X, k=Z with odd parity, and Blender's two-solution Euler
// extraction) keeps the exported curves identical to the original pipeline. Worked in f64;
// the angles round-trip through the bridge's `Euler` and only need to agree to within
// floating-point noise.

#[derive(Clone, Copy)]
pub struct Quat {
    pub w: f64,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Quat {
    pub fn conjugated(self) -> Quat {
        Quat {
            w: self.w,
            x: -self.x,
            y: -self.y,
            z: -self.z,
        }
    }

    // Hamilton product, matching Blender's mul_qt_qtqt: `self @ other`.
    pub fn mul(self, other: Quat) -> Quat {
        Quat {
            w: self.w * other.w - self.x * other.x - self.y * other.y - self.z * other.z,
            x: self.w * other.x + self.x * other.w + self.y * other.z - self.z * other.y,
            y: self.w * other.y + self.y * other.w + self.z * other.x - self.x * other.z,
            z: self.w * other.z + self.z * other.w + self.x * other.y - self.y * other.x,
        }
    }
}

// Euler (radians, stored XYZ) -> quaternion for Blender rotation order 'YXZ'
// (axis order i=1/Y, j=0/X, k=2/Z, odd parity), replicating eulO_to_quat.
pub fn euler_yxz_to_quat(x: f64, y: f64, z: f64) -> Quat {
    let ti = y * 0.5;
    let tj = -x * 0.5; // odd parity negates the half-angle on the j (X) axis
    let th = z * 0.5;
    let (ci, cj, ch) = (ti.cos(), tj.cos(), th.cos());
    let (si, sj, sh) = (ti.sin(), tj.sin(), th.sin());
    let cc = ci * ch;
    let cs = ci * sh;
    let sc = si * ch;
    let ss = si * sh;

    let a_y = cj * sc - sj * cs; // a[i]
    let a_x = cj * ss + sj * cc; // a[j]
    let a_z = cj * cs - sj * sc; // a[k]
    Quat {
        w: cj * cc + sj * ss,
        x: -a_x, // odd parity flips q[j + 1] (the X component)
        y: a_y,
        z: a_z,
    }
}

// Quaternion -> Euler (radians, stored XYZ) for order 'YXZ', replicating quat_to_mat3 +
// mat3_to_eulO (which picks the lower-L1-norm of the two valid solutions).
pub fn quat_to_euler_yxz(q: Quat) -> [f64; 3] {
    let mat = quat_to_mat3(q);
    let (first, second) = mat3_to_eul2_yxz(&mat);
    let norm1 = first[0].abs() + first[1].abs() + first[2].abs();
    let norm2 = second[0].abs() + second[1].abs() + second[2].abs();
    if norm1 > norm2 {
        second
    } else {
        first
    }
}

// Column-major 3x3 (mat[col][row]), matching Blender's quat_to_mat3 for a unit quaternion.
fn quat_to_mat3(q: Quat) -> [[f64; 3]; 3] {
    let scale = std::f64::consts::SQRT_2;
    let q0 = scale * q.w;
    let q1 = scale * q.x;
    let q2 = scale * q.y;
    let q3 = scale * q.z;
    let qda = q0 * q1;
    let qdb = q0 * q2;
    let qdc = q0 * q3;
    let qaa = q1 * q1;
    let qab = q1 * q2;
    let qac = q1 * q3;
    let qbb = q2 * q2;
    let qbc = q2 * q3;
    let qcc = q3 * q3;
    [
        [1.0 - qbb - qcc, qdc + qab, -qdb + qac],
        [-qdc + qab, 1.0 - qaa - qcc, qda + qbc],
        [qdb + qac, -qda + qbc, 1.0 - qaa - qbb],
    ]
}

fn mat3_to_eul2_yxz(mat: &[[f64; 3]; 3]) -> ([f64; 3], [f64; 3]) {
    // YXZ -> i=1 (Y), j=0 (X), k=2 (Z), odd parity.
    const I: usize = 1;
    const J: usize = 0;
    const K: usize = 2;
    let cy = (mat[I][I] * mat[I][I] + mat[I][J] * mat[I][J]).sqrt();
    let mut first = [0.0f64; 3];
    let mut second = [0.0f64; 3];
    let threshold = 16.0 * f64::from(f32::EPSILON);
    if cy > threshold {
        first[I] = mat[J][K].atan2(mat[K][K]);
        first[J] = (-mat[I][K]).atan2(cy);
        first[K] = mat[I][J].atan2(mat[I][I]);
        second[I] = (-mat[J][K]).atan2(-mat[K][K]);
        second[J] = (-mat[I][K]).atan2(-cy);
        second[K] = (-mat[I][J]).atan2(-mat[I][I]);
    } else {
        first[I] = (-mat[K][J]).atan2(mat[J][J]);
        first[J] = (-mat[I][K]).atan2(cy);
        first[K] = 0.0;
        second = first;
    }
    for value in &mut first {
        *value = -*value; // odd parity negates both solutions
    }
    for value in &mut second {
        *value = -*value;
    }
    (first, second)
}
