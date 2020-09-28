#include <stdio.h>
#include <cbm.h>

unsigned char steps(void);

unsigned char main(void) {
    puts("Hello world!");
    steps();
    return 0;
}

unsigned char steps(void) {
    puts("f is for friends who do stuff together");
    puts("u is for u and me");
    puts("n is for nywhere");
    puts("and nytime at alll");
    puts("down here in the deep blue sea!");
}

void open_a_thing(void) {
    cbm_k_open();
}
