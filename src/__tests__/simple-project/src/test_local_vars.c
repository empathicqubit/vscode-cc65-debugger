struct l {
    unsigned char m;
    unsigned char n;
};

struct hello {
    unsigned char j;
    unsigned char k;
    struct l l;
};

typedef struct hello thingy;

unsigned char globby;

unsigned char test_local_vars_main(void) {
    unsigned char i;
    unsigned int j;
    unsigned char *lol;
    struct hello wow;
    thingy *cool;
    cool = &wow;
    globby = 0x34;
    wow.j = 3;
    wow.k = 4;
    wow.l.m = 5;
    wow.l.n = 6;
    i = 0x23;
    j = 0x1337;
    lol = "copter";

    return 0;
}