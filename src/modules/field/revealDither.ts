export const REVEAL_DITHER_DECLARATION = `const float REVEAL_BAYER[16] = float[16]( 0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0 );

float getRevealThreshold( vec2 fragCoord ) {
  ivec2 cell = ivec2( mod( floor( fragCoord ), 4.0 ) );
  return ( REVEAL_BAYER[ cell.x + cell.y * 4 ] + 0.5 ) / 16.0;
}`

export const createRevealDiscard = (amount: string) =>
  `if ( ${amount} < getRevealThreshold( gl_FragCoord.xy ) ) discard;
#include <clipping_planes_fragment>`
