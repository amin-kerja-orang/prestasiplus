#!/bin/bash
lo=2001; seed=20
while [ $lo -le 406000 ]; do
  hi=$((lo+49999)); [ $hi -gt 406000 ] && hi=406000
  ./run-batch.sh $lo $hi 0.$seed
  lo=$((hi+1)); seed=$((seed+1))
done
echo ALLDONE
